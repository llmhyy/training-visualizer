
#! Noted that
#! iteration in frontend is start+(iteration -1)*period

# TODO change to timevis format
# TODO set a base class for some trainer functions... we dont need too many hyperparameters for frontend
# from tkinter import HIDDEN
from PIL import Image

from flask import request, Flask, jsonify, make_response
from flask_cors import CORS, cross_origin
import base64
import os
import sys
import json
import time
import torch
import pandas as pd
import numpy as np

from torch.utils.data import DataLoader
from torch.utils.data import WeightedRandomSampler

from umap.umap_ import find_ab_params
from sqlalchemy import create_engine, text

from antlr4 import *

timevis_path = "../../DLVisDebugger"
sys.path.append(timevis_path)
from singleVis.SingleVisualizationModel import SingleVisualizationModel
from singleVis.data import DataProvider
from singleVis.eval.evaluator import Evaluator
from singleVis.trainer import SingleVisTrainer
from singleVis.losses import ReconstructionLoss, UmapLoss, SingleVisLoss
from singleVis.visualizer import visualizer
from singleVis.custom_weighted_random_sampler import CustomWeightedRandomSampler
from singleVis.edge_dataset import DataHandler
from singleVis.eval.evaluator import Evaluator
from singleVis.spatial_edge_constructor import SingleEpochSpatialEdgeConstructor
from BackendAdapter import TimeVisBackend
from utils import *


# flask for API server
app = Flask(__name__)
cors = CORS(app, supports_credentials=True)
app.config['CORS_HEADERS'] = 'Content-Type'


@app.route('/updateProjection', methods=["POST", "GET"])
@cross_origin()
def update_projection():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    EPOCH = int(res['iteration'])
    predicates = res["predicates"]

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH)

    embedding_2d, grid, decision_view, label_color_list, label_list, max_iter, current_index, \
    testing_data_index, eval_new, prediction_list, selected_points = update_epoch_projection(timevis, EPOCH, predicates)

    sys.path.remove(CONTENT_PATH)

    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': decision_view,
                                  'label_color_list': label_color_list, 'label_list': label_list,
                                  'maximum_iteration': max_iter, 'training_data': current_index,
                                  'testing_data': testing_data_index, 'evaluation': eval_new,
                                  'prediction_list': prediction_list,
                                  "selectedPoints":selected_points.tolist()}), 200)

@app.route('/query', methods=["POST"])
@cross_origin()
def filter():
    res = request.get_json()
    CONTENT_PATH = os.path.normpath(res['path'])
    EPOCH = int(res['iteration'])
    predicates = res["predicates"]

    sys.path.append(CONTENT_PATH)
    timevis = initialize_backend(CONTENT_PATH)

    training_data_number = timevis.hyperparameters["TRAINING"]["train_num"]
    testing_data_number = timevis.hyperparameters["TRAINING"]["test_num"]

    current_index = timevis.get_epoch_index(EPOCH)
    selected_points = np.arange(training_data_number + testing_data_number)[current_index]
    for key in predicates.keys():
        if key == "label":
            tmp = np.array(timevis.filter_label(predicates[key]))
        elif key == "type":
            tmp = np.array(timevis.filter_type(predicates[key], int(EPOCH)))
        else:
            tmp = np.arange(training_data_number + testing_data_number)
        selected_points = np.intersect1d(selected_points, tmp)
    sys.path.remove(CONTENT_PATH)

    return make_response(jsonify({"selectedPoints": selected_points}), 200)


def image_cut_save(path, left, upper, right, lower, save_path):
    """
        所截区域图片保存
    :param path: 图片路径
    :param left: 区块左上角位置的像素点离图片左边界的距离
    :param upper：区块左上角位置的像素点离图片上边界的距离
    :param right：区块右下角位置的像素点离图片左边界的距离
    :param lower：区块右下角位置的像素点离图片上边界的距离
     故需满足：lower > upper、right > left
    :param save_path: 所截图片保存位置
    """
    img = Image.open(path)  # 打开图像
    box = (left, upper, right, lower)
    roi = img.crop(box)
    # print('img_stream',img_stream)
    # 保存截取的图片
    roi.save(save_path)
    # readImg(save_path)

@app.route('/sprite', methods=["POST","GET"])
@cross_origin()
def sprite_image():
    path = request.args.get("path")
    index=request.args.get("index")

    CONTENT_PATH = os.path.normpath(path)
    print('index', index)
    idx = int(index)
    pic_save_dir_path = os.path.join(CONTENT_PATH, "sprites", "{}.png".format(idx))
    img_stream = ''
    with open(pic_save_dir_path, 'rb') as img_f:
        img_stream = img_f.read()
        img_stream = base64.b64encode(img_stream).decode()
    image_type = "image/png"
    return make_response(jsonify({"imgUrl":img_stream}), 200)

@app.route('/json', methods=["POST","GET"])
@cross_origin()
def sprite_json():
    with open('graphic.json', 'r') as f:
       config = json.load(f)
    return make_response(jsonify({"imgUrl":config}), 200)
# if this is the main thread of execution first load the model and then start the server


@app.route('/al_query', methods=["POST"])
@cross_origin()
def al_query():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    iteration = data["iteration"]
    strategy = data["strategy"]
    budget = int(data["budget"])
    sys.path.append(CONTENT_PATH)

    timevis = initialize_backend(CONTENT_PATH)
    indices = timevis.al_query(iteration, budget, strategy)

    sys.path.remove(CONTENT_PATH)
    return make_response(jsonify({"selectedPoints": indices}), 200)

@app.route('/al_train', methods=["POST"])
@cross_origin()
def al_train():
    data = request.get_json()
    CONTENT_PATH = os.path.normpath(data['content_path'])
    new_indices = data["newIndices"]
    iteration = data["iteration"]
    sys.path.append(CONTENT_PATH)

    timevis = initialize_backend(CONTENT_PATH)
    timevis.al_train(iteration, new_indices)

    # preprocess
    NEW_ITERATION = iteration + 1
    PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
    B_N_EPOCHS = config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
    L_BOUND = config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]
    if PREPROCESS:
        timevis.data_provider._meta_data(NEW_ITERATION)
        if B_N_EPOCHS != 0:
            LEN = len(timevis.data_provider.train_labels(NEW_ITERATION))
            timevis.data_provider._estimate_boundary(NEW_ITERATION, LEN//10, l_bound=L_BOUND)

    # train visualization model
    CLASSES = config["CLASSES"]
    DATASET = config["DATASET"]
    DEVICE = torch.device("cuda:{:d}".format(GPU_ID) if torch.cuda.is_available() else "cpu")
    #################################################   VISUALIZATION PARAMETERS    ########################################
    PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
    B_N_EPOCHS = config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
    L_BOUND = config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]
    LAMBDA = config["VISUALIZATION"]["LAMBDA"]
    HIDDEN_LAYER = config["VISUALIZATION"]["HIDDEN_LAYER"]
    N_NEIGHBORS = config["VISUALIZATION"]["N_NEIGHBORS"]
    MAX_EPOCH = config["VISUALIZATION"]["MAX_EPOCH"]
    S_N_EPOCHS = config["VISUALIZATION"]["S_N_EPOCHS"]
    PATIENT = config["VISUALIZATION"]["PATIENT"]
    VIS_MODEL_NAME = config["VISUALIZATION"]["VIS_MODEL_NAME"]
    RESOLUTION = config["VISUALIZATION"]["RESOLUTION"]
    EVALUATION_NAME = config["VISUALIZATION"]["EVALUATION_NAME"]
    NET = config["TRAINING"]["NET"]

    t0 = time.time()
    spatial_cons = SingleEpochSpatialEdgeConstructor(timevis.data_provider, NEW_ITERATION, S_N_EPOCHS, B_N_EPOCHS, 15)
    edge_to, edge_from, probs, feature_vectors, attention = spatial_cons.construct()
    t1 = time.time()

    probs = probs / (probs.max()+1e-3)
    eliminate_zeros = probs>1e-3
    edge_to = edge_to[eliminate_zeros]
    edge_from = edge_from[eliminate_zeros]
    probs = probs[eliminate_zeros]

    # save result
    save_dir = os.path.join(timevis.data_provider.model_path, "SV_time_al.json")
    if not os.path.exists(save_dir):
        evaluation = dict()
    else:
        f = open(save_dir, "r")
        evaluation = json.load(f)
        f.close()
    if "complex_construction" not in evaluation.keys():
        evaluation["complex_construction"] = dict()
    evaluation["complex_construction"][str(NEW_ITERATION)] = round(t1-t0, 3)
    with open(save_dir, 'w') as f:
        json.dump(evaluation, f)
    print("constructing timeVis complex in {:.1f} seconds.".format(t1-t0))


    dataset = DataHandler(edge_to, edge_from, feature_vectors, attention)
    n_samples = int(np.sum(S_N_EPOCHS * probs) // 1)
    # chosse sampler based on the number of dataset
    if len(edge_to) > 2^24:
        sampler = CustomWeightedRandomSampler(probs, n_samples, replacement=True)
    else:
        sampler = WeightedRandomSampler(probs, n_samples, replacement=True)
    edge_loader = DataLoader(dataset, batch_size=1024, sampler=sampler)
    timevis.trainer.update_edge_loader(edge_loader)

    t2=time.time()
    timevis.trainer.train(PATIENT, MAX_EPOCH)
    t3 = time.time()
    # save result
    save_dir = os.path.join(timevis.data_provider.model_path, "SV_time_al.json")
    if not os.path.exists(save_dir):
        evaluation = dict()
    else:
        f = open(save_dir, "r")
        evaluation = json.load(f)
        f.close()
    if  "training" not in evaluation.keys():
        evaluation["training"] = dict()
    evaluation["training"][str(NEW_ITERATION)] = round(t3-t2, 3)
    with open(save_dir, 'w') as f:
        json.dump(evaluation, f)
    save_dir = os.path.join(timevis.data_provider.model_path, "Iteration_{}".format(NEW_ITERATION))
    os.system("mkdir -p {}".format(save_dir))
    timevis.trainer.save(save_dir=save_dir, file_name="al")
    
    # update iteration projection
    embedding_2d, grid, decision_view, label_color_list, label_list, _, current_index, \
    testing_data_index, eval_new, prediction_list, selected_points = update_epoch_projection(timevis, NEW_ITERATION, dict())

    sys.path.remove(CONTENT_PATH)
    return make_response(jsonify({'result': embedding_2d, 'grid_index': grid, 'grid_color': decision_view,
                                  'label_color_list': label_color_list, 'label_list': label_list,
                                  'maximum_iteration': NEW_ITERATION, 'training_data': current_index,
                                  'testing_data': testing_data_index, 'evaluation': eval_new,
                                  'prediction_list': prediction_list,
                                  "selectedPoints":selected_points.tolist()}), 200)

if __name__ == "__main__":
    with open('config.json', 'r') as f:
        config = json.load(f)
        ip_adress = config["ServerIP"]
        port = config["ServerPort"]
    app.run(host=ip_adress, port=int(port))
