'''This class serves as a intermediate layer for tensorboard frontend and timeVis backend'''
import os
import sys
import json
import time
import torch
import pandas as pd
import numpy as np
from scipy.special import softmax
import torchvision

import torch.nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torch.utils.data import WeightedRandomSampler

timevis_path = "../../DLVisDebugger"
sys.path.append(timevis_path)
from singleVis.utils import *
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

active_learning_path = "../../ActiveLearning"
sys.path.append(active_learning_path)


class TimeVisBackend:
    def __init__(self, data_provider, trainer, vis, evaluator, **hyperparameters) -> None:
        self.data_provider = data_provider
        self.trainer = trainer
        self.trainer.model.eval()
        self.vis = vis
        self.evaluator = evaluator
        self.hyperparameters = hyperparameters
    #################################################################################################################
    #                                                                                                               #
    #                                                data Panel                                                     #
    #                                                                                                               #
    #################################################################################################################

    def batch_project(self, data):
        embedding = self.trainer.model.encoder(torch.from_numpy(data).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return embedding
    
    def individual_project(self, data):
        embedding = self.trainer.model.encoder(torch.from_numpy(np.expand_dims(data, axis=0)).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return embedding.squeeze(axis=0)
    
    def batch_inverse(self, embedding):
        data = self.trainer.model.decoder(torch.from_numpy(embedding).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return data
    
    def individual_inverse(self, embedding):
        data = self.trainer.model.decoder(torch.from_numpy(np.expand_dims(embedding, axis=0)).to(dtype=torch.float32, device=self.trainer.DEVICE)).cpu().detach().numpy()
        return data.squeeze(axis=0)

    def batch_inv_preserve(self, epoch, data):
        """
        get inverse confidence for a single point
        :param epoch: int
        :param data: numpy.ndarray
        :return l: boolean, whether reconstruction data have the same prediction
        :return conf_diff: float, (0, 1), confidence difference
        """
        self.trainer.model.eval()
        embedding = self.batch_project(data)
        recon = self.batch_inverse(embedding)
    
        ori_pred = self.data_provider.get_pred(epoch, data)
        new_pred = self.data_provider.get_pred(epoch, recon)
        ori_pred = softmax(ori_pred, axis=1)
        new_pred = softmax(new_pred, axis=1)

        old_label = ori_pred.argmax(-1)
        new_label = new_pred.argmax(-1)
        l = old_label == new_label

        old_conf = [ori_pred[i, old_label[i]] for i in range(len(old_label))]
        new_conf = [new_pred[i, old_label[i]] for i in range(len(old_label))]
        old_conf = np.array(old_conf)
        new_conf = np.array(new_conf)

        conf_diff = old_conf - new_conf
        return l, conf_diff
    
    #################################################################################################################
    #                                                                                                               #
    #                                                Search Panel                                                   #
    #                                                                                                               #
    #################################################################################################################

    # TODO: fix bugs accroding to new api
    # customized features
    def filter_label(self, label, epoch_id):
        try:
            index = self.data_provider.classes.index(label)
        except:
            index = -1
        train_labels = self.data_provider.train_labels(epoch_id)
        test_labels = self.data_provider.test_labels(epoch_id)
        labels = np.concatenate((train_labels, test_labels), 0)
        idxs = np.argwhere(labels == index)
        idxs = np.squeeze(idxs)
        return idxs

    def filter_type(self, type, epoch_id):
        if type == "train":
            res = self.get_epoch_index(epoch_id)
        elif type == "test":
            train_num = self.data_provider.train_num
            test_num = self.data_provider.test_num
            res = list(range(train_num, test_num, 1))
        elif type == "unlabel":
            labeled = np.array(self.get_epoch_index(epoch_id))
            train_num = self.data_provider.train_num
            all_data = np.arange(train_num)
            unlabeled = np.setdiff1d(all_data, labeled)
            res = unlabeled.tolist()
        else:
            # all data
            train_num = self.data_provider.train_num
            test_num = self.data_provider.test_num
            res = list(range(0, train_num + test_num, 1))
        return res

    def filter_prediction(self, pred):
        pass

    #################################################################################################################
    #                                                                                                               #
    #                                             Helper Functions                                                  #
    #                                                                                                               #
    #################################################################################################################

    def get_epoch_index(self, epoch_id):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.data_provider.model_path, "Epoch_{:d}".format(epoch_id), "index.json")
        index = load_labelled_data_index(index_file)
        return index


class ActiveLearningTimeVisBackend(TimeVisBackend):
    def __init__(self, data_provider, trainer, vis, evaluator, **hyprparameters) -> None:
        super().__init__(data_provider, trainer, vis, evaluator, **hyprparameters)
    
    def get_epoch_index(self, iteration):
        """get the training data index for an epoch"""
        index_file = os.path.join(self.data_provider.model_path, "Iteration_{:d}".format(iteration), "index.json")
        index = load_labelled_data_index(index_file)
        return index

    def al_query(self, iteration, budget, strategy):
        """get the index of new selection from different strategies"""
        CONTENT_PATH = self.data_provider.content_path
        NUM_QUERY = budget
        TOTAL_EPOCH = self.hyperparameters["TRAINING"]["total_epoch"]
        METHOD = strategy
        # TODO fix me
        GPU = "0"
        NET = self.hyperparameters["TRAINING"]["NET"]
        DATA_NAME = self.hyperparameters["DATASET"]

        sys.path.append(CONTENT_PATH)

        # record output information
        now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

        # for reproduce purpose
        torch.manual_seed(1331)
        np.random.seed(1131)

        # loading neural network
        import Model.model as subject_model
        task_model = eval("subject_model.{}()".format(NET))
        task_model_type = "pytorch"
        # start experiment
        n_pool = self.hyperparameters["TRAINING"]["train_num"]  # 50000
        n_test = self.hyperparameters["TRAINING"]['test_num']   # 10000

        resume_path = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration))
        idxs_lb = np.array(json.load(open(os.path.join(resume_path, "index.json"), "r")))
        state_dict = torch.load(os.path.join(resume_path, "subject_model.pth"))
        task_model.load_state_dict(state_dict)
        NUM_INIT_LB = len(idxs_lb)

        print('resume from iteration {}'.format(iteration))
        print('number of labeled pool: {}'.format(NUM_INIT_LB))
        print('number of unlabeled pool: {}'.format(n_pool - NUM_INIT_LB))
        print('number of testing pool: {}'.format(n_test))

        # here the training handlers and testing handlers are different
        complete_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=True, transform=self.hyperparameters["TRAINING"]['transform_te'])

        if strategy == "random":
            from query_strategies.random import RandomSampling
            q_strategy = RandomSampling(task_model, task_model_type, n_pool, idxs_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            # print information
            print(DATA_NAME)
            print(type(strategy).__name__)
            print('================Round {:d}==============='.format(iteration+1))
            # query new samples
            t0 = time.time()
            new_indices = q_strategy.query(NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        elif strategy == "LeastConfidence":
            from query_strategies.LeastConfidence import LeastConfidenceSampling
            q_strategy = LeastConfidenceSampling(task_model, task_model_type, n_pool, idxs_lb, 10, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])
            # print information
            print(DATA_NAME)
            print(type(strategy).__name__)

            print('================Round {:d}==============='.format(iteration+1))

            # query new samples
            t0 = time.time()
            new_indices = q_strategy.query(complete_dataset, NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))
        
        elif strategy == "coreset":
            from query_strategies.coreset import CoreSetSampling
            q_strategy = CoreSetSampling(task_model, task_model_type, n_pool, 512, idxs_lb, DATA_NAME, NET, gpu=GPU, **self.hyperparameters["TRAINING"])

            print('================Round {:d}==============='.format(iteration+1))

            embedding = q_strategy.get_embedding(complete_dataset)

            # query new samples
            t0 = time.time()
            new_indices = q_strategy.query(embedding, NUM_QUERY)
            t1 = time.time()
            print("Query time is {:.2f}".format(t1-t0))

        return new_indices
    
    def al_train(self, iteration, indices):
        self.save_human_selection(iteration, indices)
        lb_idx = self.data_provider.get_labeled_idx(iteration)
        train_idx = np.hstack((lb_idx, indices))

        CONTENT_PATH = self.data_provider.content_path
        TOTAL_EPOCH = self.hyperparameters["TRAINING"]["total_epoch"]
        NET = self.hyperparameters["TRAINING"]["NET"]
        DEVICE = self.data_provider.DEVICE
        # sys.path.append(CONTENT_PATH)

        # record output information
        now = time.strftime("%Y-%m-%d-%H_%M_%S", time.localtime(time.time())) 
        sys.stdout = open(os.path.join(CONTENT_PATH, now+".txt"), "w")

        # for reproduce purpose
        torch.manual_seed(1331)
        np.random.seed(1131)

        # loading neural network
        import Model.model as subject_model
        task_model = eval("subject_model.{}()".format(NET))
        # start experiment

        new_iteration_dir = os.path.join(CONTENT_PATH, "Model", "Iteration_{}".format(iteration+1))
        os.system("mkdir -p {}".format(new_iteration_dir))

        save_location = os.path.join(new_iteration_dir, "index.json")
        with open(save_location, "w") as f:
            json.dump(train_idx.tolist(), f)
        
        t1 = time.time()
        task_model.to(DEVICE)
        # setting idx_lb
        train_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=True, transform=self.hyperparameters["TRAINING"]['transform_tr'])
        test_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=False, transform=self.hyperparameters["TRAINING"]['transform_te'])
        complete_dataset = torchvision.datasets.CIFAR10(root="..//data//CIFAR10", download=True, train=True, transform=self.hyperparameters["TRAINING"]['transform_te'])
        train_dataset = Subset(train_dataset, train_idx)
        train_loader = DataLoader(train_dataset, batch_size=self.hyperparameters["TRAINING"]['loader_tr_args']['batch_size'], shuffle=True, num_workers=self.hyperparameters["TRAINING"]['loader_tr_args']['num_workers'])
        optimizer = optim.SGD(
            task_model.parameters(), lr=self.hyperparameters["TRAINING"]['optimizer_args']['lr'], momentum=self.hyperparameters["TRAINING"]['optimizer_args']['momentum'], weight_decay=self.hyperparameters["TRAINING"]['optimizer_args']['weight_decay']
        )
        criterion = torch.nn.CrossEntropyLoss(reduction='none')
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=TOTAL_EPOCH)
        # scheduler = torch.optim.lr_scheduler.MultiStepLR(optimizer, milestones=self.hyperparameters["TRAINING"]['milestone']) # official implementation

        for epoch in range(TOTAL_EPOCH):
            task_model.train()

            total_loss = 0
            n_batch = 0
            acc = 0

            for inputs, targets in train_loader:
                n_batch += 1
                inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)

                optimizer.zero_grad()
                outputs = task_model(inputs)
                loss = criterion(outputs, targets)
                loss = torch.mean(loss)
                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                predicted = outputs.argmax(1)
                b_acc = 1.0 * (targets == predicted).sum().item() / targets.shape[0]
                acc += b_acc

            total_loss /= n_batch
            acc /= n_batch

            if epoch % 50 == 0 or epoch == TOTAL_EPOCH-1:
                print('==========Inner epoch {:d} ========'.format(epoch))
                print('Training Loss {:.3f}'.format(total_loss))
                print('Training accuracy {:.3f}'.format(acc*100))
            scheduler.step()
        t2 = time.time()
        print("Training time is {:.2f}".format(t2-t1))
        # save model
        model_path = os.path.join(new_iteration_dir, "subject_model.pth")
        torch.save(task_model.state_dict(), model_path)

        # compute accuracy at each round
        loader_te = DataLoader(test_dataset, shuffle=False, **self.hyperparameters["TRAINING"]['loader_te_args'])
        task_model.to(DEVICE)
        task_model.eval()

        batch_size = self.hyperparameters["TRAINING"]['loader_te_args']['batch_size']
        label = np.array(test_dataset.targets)
        pred = np.zeros(len(label), dtype=np.long)
        with torch.no_grad():
            for idx, (x, y) in enumerate(loader_te):
                x, y = x.to(DEVICE), y.to(DEVICE)
                out = task_model(x)
                p = out.argmax(1)
                pred[idx*batch_size:(idx+1)*batch_size] = p.cpu().numpy()

        acc =  np.sum(pred == label) / float(label.shape[0])
        print('Test Accuracy {:.3f}'.format(100*acc))


    def save_human_selection(self, iteration, indices):
        """
        save the selected index message from DVI frontend
        :param epoch_id:
        :param indices: list, selected indices
        :return:
        """
        save_location = os.path.join(self.data_provider.model_path, "Iteration_{}".format(iteration), "human_select.json")
        with open(save_location, "w") as f:
            json.dump(indices, f)
    
    def vis_train(self, iteration, **config):
        # preprocess
        PREPROCESS = config["VISUALIZATION"]["PREPROCESS"]
        B_N_EPOCHS = config["VISUALIZATION"]["BOUNDARY"]["B_N_EPOCHS"]
        L_BOUND = config["VISUALIZATION"]["BOUNDARY"]["L_BOUND"]
        if PREPROCESS:
            self.data_provider._meta_data(iteration)
            if B_N_EPOCHS != 0:
                LEN = len(self.data_provider.train_labels(iteration))
                self.data_provider._estimate_boundary(iteration, LEN//10, l_bound=L_BOUND)

        # train visualization model
        CLASSES = config["CLASSES"]
        DATASET = config["DATASET"]
        # DEVICE = torch.device("cuda:{:}".format(GPU_ID) if torch.cuda.is_available() else "cpu")
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
        spatial_cons = SingleEpochSpatialEdgeConstructor(self.data_provider, iteration, S_N_EPOCHS, B_N_EPOCHS, 15)
        edge_to, edge_from, probs, feature_vectors, attention = spatial_cons.construct()
        t1 = time.time()

        probs = probs / (probs.max()+1e-3)
        eliminate_zeros = probs>1e-3
        edge_to = edge_to[eliminate_zeros]
        edge_from = edge_from[eliminate_zeros]
        probs = probs[eliminate_zeros]

        # save result
        save_dir = os.path.join(self.data_provider.model_path, "SV_time_al.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        if "complex_construction" not in evaluation.keys():
            evaluation["complex_construction"] = dict()
        evaluation["complex_construction"][str(iteration)] = round(t1-t0, 3)
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
        self.trainer.update_edge_loader(edge_loader)

        t2=time.time()
        self.trainer.train(PATIENT, MAX_EPOCH)
        t3 = time.time()
        # save result
        save_dir = os.path.join(self.data_provider.model_path, "SV_time_al.json")
        if not os.path.exists(save_dir):
            evaluation = dict()
        else:
            f = open(save_dir, "r")
            evaluation = json.load(f)
            f.close()
        if  "training" not in evaluation.keys():
            evaluation["training"] = dict()
        evaluation["training"][str(iteration)] = round(t3-t2, 3)
        with open(save_dir, 'w') as f:
            json.dump(evaluation, f)
        save_dir = os.path.join(self.data_provider.model_path, "Iteration_{}".format(iteration))
        os.system("mkdir -p {}".format(save_dir))
        self.trainer.save(save_dir=save_dir, file_name="al")

        
        