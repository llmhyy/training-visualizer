/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import { PolymerElement } from '@polymer/polymer';
import { customElement, observe, property } from '@polymer/decorators';

import { LegacyElementMixin } from '../../../components/polymer/legacy_element_mixin';
import '../../../components/polymer/irons_and_papers';

import { DistanceFunction, SpriteAndMetadataInfo, State, DataSet } from './data';
import { template } from './vz-projector-inspector-panel.html';
import './vz-projector-input';
import { dist2color, normalizeDist } from './projectorScatterPlotAdapter';
import { ProjectorEventContext } from './projectorEventContext';
import { ScatterPlot, MouseMode } from './scatterPlot';


import { ProjectorScatterPlotAdapter } from './projectorScatterPlotAdapter';

import * as knn from './knn';
import * as vector from './vector';
import * as util from './util';
import * as logging from './logging';

const LIMIT_RESULTS = 10000;
const DEFAULT_NEIGHBORS = 100;

type SpriteMetadata = {
  imagePath?: string;
  singleImageDim?: number[];
  aspectRatio?: number;
  nCols?: number;
};

@customElement('vz-projector-inspector-panel')
class InspectorPanel extends LegacyElementMixin(PolymerElement) {
  static readonly template = template;

  dataSet: DataSet;

  @property({ type: String })
  selectedStratergy: string = 'Interest potential';

  @property({ type: String })
  selectedAnormalyStratergy: string;

  @property({ type: Number })
  selectedAnormalyClass: number = 0;

  @property({ type: Number })
  budget: number

  @property({ type: Number })
  anomalyRecNum: number

  @property({ type: Number })
  suggestKNum: number

  @property({ type: String })
  selectedMetadataField: string;

  @property({ type: Array })
  metadataFields: Array<string>;

  @property({ type: String })
  metadataColumn: string;

  @property({ type: Number })
  numNN: number = DEFAULT_NEIGHBORS;

  @property({ type: Object })
  spriteMeta: SpriteMetadata;

  @property({ type: Boolean })
  showNeighborImages: boolean = true;

  @property({ type: Number })
  confidenceThresholdFrom: number

  @property({ type: Number })
  confidenceThresholdTo: number

  @property({ type: Boolean })
  disabledAlExBase: boolean = false


  // @property({ type: Number })
  // epochFrom: number

  // @property({ type: Number })
  // epochTo: number

  @property({ type: Boolean })
  showTrace: false

  @property({ type: Number })
  currentPlayedEpoch: number

  @property({ type: Number })
  totalEpoch: number

  @property({ type: Boolean })
  spriteImagesAvailable: Boolean = true;

  @property({ type: Boolean })
  noShow: Boolean = false;

  @property({ type: Boolean })
  isCollapsed: boolean = false;

  @property({ type: Boolean })
  checkAllQueryRes: boolean = false

  @property({ type: String })
  collapseIcon: string = 'expand-less';

  @property({ type: Boolean })
  showAnomaly: boolean = false

  @property({ type: Boolean })
  isControlGroup: boolean = false

  @property({ type: Boolean })
  shownormal: boolean = false

  @property({ type: String })
  queryResultListTitle: string = 'Query Result List'

  @property({ type: Boolean })
  showCheckAllQueryRes: boolean = true

  @property({ type: Boolean })
  showMoreRecommend: boolean = true


  @property({ type: Boolean })
  showPlayAndStop: boolean = false
  

  @property({ type: Number })
  moreRecommednNum: number = 10

  @property({ type: Boolean })
  accAll: boolean = false

  @property({ type: Boolean })
  rejAll: boolean = false


  @property({ type: Boolean })
  showUnlabeledChecked: boolean = true


  distFunc: DistanceFunction;

  public scatterPlot: ScatterPlot;
  private projectorEventContext: ProjectorEventContext;
  private projectionsPanel: any;
  private displayContexts: string[];
  private projector: any; // Projector; type omitted b/c LegacyElement
  private selectedPointIndices: number[];
  private neighborsOfFirstPoint: knn.NearestEntry[];
  private searchBox: any; // ProjectorInput; type omitted b/c LegacyElement

  private queryByStrategtBtn: HTMLButtonElement;
  private moreRecommend: HTMLButtonElement;
  private queryAnomalyBtn: HTMLButtonElement;
  private showSelectionBtn: HTMLButtonElement;
  private noisyshowSelectionBtn: HTMLButtonElement;

  private boundingSelectionBtn: HTMLButtonElement;
  private isAlSelecting: boolean;
  private trainBySelBtn: HTMLButtonElement;

  private resetFilterButton: HTMLButtonElement;
  private setFilterButton: HTMLButtonElement;
  private clearSelectionButton: HTMLButtonElement;
  private searchButton: HTMLButtonElement;
  private addButton: HTMLButtonElement;
  private resetButton: HTMLButtonElement;
  private sentButton: HTMLButtonElement;
  private showButton: HTMLButtonElement;
  private selectinMessage: HTMLElement;

  private noisyBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private scatterPlotContainer: HTMLElement;

  private limitMessage: HTMLDivElement;
  private _currentNeighbors: any;
  // save current predicates
  private currentPredicate: { [key: string]: any }; // dictionary
  private queryIndices: number[];
  private searchPredicate: string;
  private searchInRegexMode: boolean;
  private filterIndices: number[];
  private searchFields: string[];
  private statergyList: string[];
  private anormalyStatergyList: string[];
  private classOptionsList: any;
  private boundingBoxSelection: number[];
  private currentBoundingBoxSelection: number[];
  private projectorScatterPlotAdapter: ProjectorScatterPlotAdapter;

  private rejAllRadio: any;
  private accAllRadio: any;


  private currentFilterType: string

  private labelMap: any



  ready() {
    super.ready();

    this.isAlSelecting = false

    this.currentFilterType = 'normal'



    this.showAnomaly = window.sessionStorage.taskType == 'anormaly detection'
    this.shownormal = window.sessionStorage.taskType == 'active learning' || window.taskType == 'active learning'
    this.isControlGroup = window.sessionStorage.isControlGroup == 'true'

    // this.showUnlabeledChecked = window.sessionStorage.taskType == 'active learning' || window.taskType == 'active learning'

    // if (window.sessionStorage.taskType == 'active learning') {
    //   this.moreRecommednNum = 100
    // }
    this.queryByStrategtBtn = this.$$('.query-by-stratergy') as HTMLButtonElement;
    this.moreRecommend = this.$$('.query-by-sel-btn') as HTMLButtonElement;
    this.showSelectionBtn = this.$$('.show-selection') as HTMLButtonElement;
    this.noisyshowSelectionBtn = this.$$('.noisy-show-selection') as HTMLButtonElement
    this.queryAnomalyBtn = this.$$('.query-anomaly') as HTMLButtonElement;

    this.accAllRadio = this.$$('#accAllRadio') as HTMLElement;
    this.rejAllRadio = this.$$('#rejAllRadio') as HTMLElement;
    // this.boundingSelectionBtn = this.$$('.bounding-selection') as HTMLButtonElement;

    // this.resetFilterButton = this.$$('.reset-filter') as HTMLButtonElement;
    // this.setFilterButton = this.$$('.set-filter') as HTMLButtonElement;
    // this.clearSelectionButton = this.$$(
    //   '.clear-selection'
    // ) as HTMLButtonElement;
    this.noisyBtn = this.$$('.show-noisy-btn') as HTMLButtonElement
    this.stopBtn = this.$$('.stop-animation-btn') as HTMLButtonElement

    this.searchButton = this.$$('.search') as HTMLButtonElement;
    this.addButton = this.$$('.add') as HTMLButtonElement;
    this.resetButton = this.$$('.reset') as HTMLButtonElement;
    this.sentButton = this.$$('.sent') as HTMLButtonElement;
    this.showButton = this.$$('.show') as HTMLButtonElement;
    // this.selectinMessage = this.$$('.boundingBoxSelection') as HTMLElement;
    this.trainBySelBtn = this.$$('.train-by-selection') as HTMLButtonElement
    this.projectionsPanel = this.$['projections-panel'] as any; // ProjectionsPanel


    this.limitMessage = this.$$('.limit-msg') as HTMLDivElement;
    this.searchBox = this.$$('#search-box') as any; // ProjectorInput
    this.displayContexts = [];
    // show noisy points

    this.currentPredicate = {};
    this.queryIndices = [];
    this.filterIndices = [];
    this.boundingBoxSelection = [];
    this.currentBoundingBoxSelection = [];
    // this.selectinMessage.innerText = "0 seleted.";
    this.confidenceThresholdFrom = 0
    this.confidenceThresholdTo = 1

    this.disabledAlExBase = false
    // this.epochFrom = 1
    // this.epochTo = 1
    this.showTrace = false
    this.checkAllQueryRes = false

    this.budget = 10
    this.anomalyRecNum = 10
    this.suggestKNum = 10
  }
  initialize(projector: any, projectorEventContext: ProjectorEventContext) {
    this.projector = projector;
    this.projectorEventContext = projectorEventContext;
    this.setupUI(projector);
    this.labelMap = {
      "0": "plane",
      "1": "car",
      "2": "bird",
      "3": "cat",
      "4": "deer",
      "5": "dog",
      "6": "frog",
      "7": "horse",
      "8": "ship",
      "9": "truck"
    }
    projectorEventContext.registerSelectionChangedListener(
      (selection, neighbors) => this.updateInspectorPane(selection, neighbors)
    );
    // TODO change them based on metadata fields
    this.searchFields = ["type", "label"]
    // active learning statergy
    this.statergyList = ["Interest potential", "Random"]
    // anormaly detection statergy
    this.anormalyStatergyList = ['anormalyStageone', 'anormalyStageTwo', 'anormalyStageThree']
    // anormaly detcttion classes
    this.classOptionsList = [{ value: 0, label: 'airplane' }, { value: 1, label: 'car' }, { value: 2, label: 'bird' }, { value: 3, label: 'cat' }, { value: 4, label: 'deer' }, { value: 5, label: 'dog' }, { value: 6, label: 'frog' }, { value: 7, label: 'horse' }, { value: 8, label: 'ship' }, { value: 9, label: 'truck' }]
    // TODO read real points length from dataSet
    for (let i = 0; i < 60000; i++) {
      this.filterIndices.push(i);
    }
    this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
    this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
  }
  /** Updates the nearest neighbors list in the inspector. */
  private updateInspectorPane(
    indices: number[],
    neighbors: knn.NearestEntry[]
  ) {
    this.neighborsOfFirstPoint = neighbors;
    this.selectedPointIndices = indices;
    // this.updateFilterButtons(indices.length + neighbors.length);
    // this.updateFilterButtons(indices.length);
    this.updateNeighborsList(neighbors);
    if (neighbors.length === 0) {
      this.updateSearchResults(indices);
    } else {
      this.updateSearchResults([]);
    }
  }
  private enableResetFilterButton(enabled: boolean) {
    // this.resetFilterButton.disabled = !enabled;
  }

  /** Handles toggle of metadata-container. */
  _toggleMetadataContainer() {
    (this.$$('#metadata-container') as any).toggle();
    this.isCollapsed = !this.isCollapsed;
    this.set('collapseIcon', this.isCollapsed ? 'expand-more' : 'expand-less');
  }
  refreshBtnStyle(){
    this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
    this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
  }
  restoreUIFromBookmark(bookmark: State) {
    this.enableResetFilterButton(bookmark.filteredPoints != null);
  }
  metadataChanged(spriteAndMetadata: SpriteAndMetadataInfo) {
    let labelIndex = -1;
    this.metadataFields = spriteAndMetadata.stats.map((stats, i) => {
      if (!stats.isNumeric && labelIndex === -1) {
        labelIndex = i;
      }
      return stats.name;
    });
    if (
      spriteAndMetadata.spriteMetadata &&
      spriteAndMetadata.spriteMetadata.imagePath
    ) {
      const [
        spriteWidth,
        spriteHeight,
      ] = spriteAndMetadata.spriteMetadata.singleImageDim;
      this.spriteMeta = {
        imagePath: spriteAndMetadata.spriteImage?.src,
        aspectRatio: spriteWidth / spriteHeight,
        nCols: Math.floor(spriteAndMetadata.spriteImage?.width / spriteWidth),
        singleImageDim: [spriteWidth, spriteHeight],
      };
    } else {
      this.spriteMeta = {};
    }
    this.spriteImagesAvailable = !!this.spriteMeta.imagePath;
    if (
      this.selectedMetadataField == null ||
      this.metadataFields.filter((name) => name === this.selectedMetadataField)
        .length === 0
    ) {
      // Make the default label the first non-numeric column.
      this.selectedMetadataField = this.metadataFields[Math.max(0, labelIndex)];
    }
    this.updateInspectorPane(
      this.selectedPointIndices,
      this.neighborsOfFirstPoint
    );
  }
  datasetChanged() {
    this.enableResetFilterButton(false);
  }

  @observe('showNeighborImages', 'spriteImagesAvailable')
  _refreshNeighborsList() {
    this.updateNeighborsList();
  }

  @observe('accAll')
  _accAllRes() {
    if (this.accAll) {
      console.log(12333)
    }

  }



  @observe('showTrace')
  _refreshScatterplot() {
    if (this.showTrace) {
      this.projectorEventContext?.renderInTraceLine(true)
    } else {
      this.projectorEventContext?.renderInTraceLine(false)
    }
  }
  @observe('checkAllQueryRes')
  _checkAll() {
    if (this.checkAllQueryRes) {
      if (window.checkboxDom) {
        if (window.queryResPointIndices && window.queryResPointIndices.length) {
          for (let i = 0; i < window.queryResPointIndices.length; i++) {
            let index = window.queryResPointIndices[i]
            if (window.customSelection.indexOf(index) === -1) {
              if (window.checkboxDom[index]) {
                window.checkboxDom[index].checked = true
              }
              window.customSelection.push(index)
            }
          }
          this.projectorEventContext.refresh()
        }
      }
    } else {
      if (window.checkboxDom) {
        if (window.queryResPointIndices && window.queryResPointIndices.length) {
          for (let i = 0; i < window.queryResPointIndices.length; i++) {
            let index = window.queryResPointIndices[i]
            if (window.customSelection.indexOf(index) !== -1) {
              let m = window.customSelection.indexOf(index)
              if (window.checkboxDom[index]) {
                window.checkboxDom[index].checked = false
              }
              window.customSelection.splice(m, 1)
              this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
              this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
            }
          }
          this.projectorEventContext.refresh()
        }
      }
    }
  }

  metadataEditorContext(enabled: boolean, metadataColumn: string) {
    if (!this.projector || !this.projector.dataSet) {
      return;
    }
    let stat = this.projector.dataSet.spriteAndMetadataInfo.stats.filter(
      (s) => s.name === metadataColumn
    );
    if (!enabled || stat.length === 0 || stat[0].tooManyUniqueValues) {
      this.removeContext('.metadata-info');
      return;
    }
    this.metadataColumn = metadataColumn;
    this.addContext('.metadata-info');
    let list = this.$$('.metadata-list') as HTMLDivElement;
    list.textContent = '';
    let entries = stat[0].uniqueEntries.sort((a, b) => a.count - b.count);
    let maxCount = entries[entries.length - 1].count;
    entries.forEach((e) => {
      const metadataElement = document.createElement('div');
      metadataElement.className = 'metadata';
      const metadataElementLink = document.createElement('a');
      metadataElementLink.className = 'metadata-link';
      metadataElementLink.title = e.label;
      const labelValueElement = document.createElement('div');
      labelValueElement.className = 'label-and-value';
      const labelElement = document.createElement('div');
      labelElement.className = 'label';
      labelElement.style.color = dist2color(this.distFunc, maxCount, e.count);
      labelElement.innerText = e.label;
      const valueElement = document.createElement('div');
      valueElement.className = 'value';
      valueElement.innerText = e.count.toString();
      labelValueElement.appendChild(labelElement);
      labelValueElement.appendChild(valueElement);
      const barElement = document.createElement('div');
      barElement.className = 'bar';
      const barFillElement = document.createElement('div');
      barFillElement.className = 'fill';
      barFillElement.style.borderTopColor = dist2color(
        this.distFunc,
        maxCount,
        e.count
      );
      barFillElement.style.width =
        normalizeDist(this.distFunc, maxCount, e.count) * 100 + '%';
      barElement.appendChild(barFillElement);
      for (let j = 1; j < 4; j++) {
        const tickElement = document.createElement('div');
        tickElement.className = 'tick';
        tickElement.style.left = (j * 100) / 4 + '%';
        barElement.appendChild(tickElement);
      }
      metadataElementLink.appendChild(labelValueElement);
      metadataElementLink.appendChild(barElement);
      metadataElement.appendChild(metadataElementLink);
      list.appendChild(metadataElement);
      metadataElementLink.onclick = () => {
        this.projector.metadataEdit(metadataColumn, e.label);
      };
    });
  }

  private addContext(context: string) {
    if (this.displayContexts.indexOf(context) === -1) {
      this.displayContexts.push(context);
    }
    this.displayContexts.forEach((c) => {
      (this.$$(c) as HTMLDivElement).style.display = 'none';
    });
    (this.$$(context) as HTMLDivElement).style.display = null;
  }
  private removeContext(context: string) {
    this.displayContexts = this.displayContexts.filter((c) => c !== context);
    (this.$$(context) as HTMLDivElement).style.display = 'none';
    if (this.displayContexts.length > 0) {
      let lastContext = this.displayContexts[this.displayContexts.length - 1];
      (this.$$(lastContext) as HTMLDivElement).style.display = null;
    }
  }
  clearQueryResList() {
    this.updateSearchResults([])
  }
  refreshSearchResult() {
    this.updateSearchResults(this.queryIndices)
  }

  refreshSearchResByList(list: any) {
    this.updateSearchResults(list)
  }
  private async updateSearchResults(indices: number[]) {
    if (this.accAllRadio?.checked || this.rejAllRadio?.checked) {
      this.accAllRadio.checked = false
      this.rejAllRadio.checked = false
    }
    const container = this.$$('.matches-list') as HTMLDivElement;
    const list = container.querySelector('.list') as HTMLDivElement;
    list.textContent = '';
    if (indices.length === 0) {
      this.removeContext('.matches-list');
      return;
    }
    this.addContext('.matches-list');
    this.limitMessage.style.display =
      indices.length <= LIMIT_RESULTS ? 'none' : null;
    indices = indices.slice(0, LIMIT_RESULTS);
    this.moreRecommend = container.querySelector('.query-by-sel-btn') as HTMLButtonElement

    // const msgId = logging.setModalMessage('Fetching sprite image...');
    if (this.moreRecommend) {

      this.moreRecommend.onclick = () => {
        if (!window.acceptIndicates || !window.rejectIndicates) {
          logging.setErrorMessage('Please confirm some selection first');
          return
        }
        if (window.sessionStorage.taskType === 'active learning') {
          // let accIndices = []
          // let rejIndices = []
          // if (!window.previousIndecates) {
          //   window.previousIndecates = []
          // }
          // if (!window.acceptIndicates) {
          //   window.acceptIndicates = []
          // } else {
          //   for (let i = 0; i < window.acceptIndicates.length; i++) {
          //     if (window.previousIndecates.indexOf(window.customSelection[i]) == -1) {
          //       accIndices.push(window.customSelection[i])
          //     } else {
          //       previoustIIndices.push(window.customSelection[i])
          //     }
          //   }
          // }
          this.queryByAl(this.projector, window.acceptIndicates, window.rejectIndicates, this.moreRecommednNum, false)
        } else if (window.sessionStorage.taskType === 'anormaly detection') {
          let confirmInfo: any[] = []
          for (let i = 0; i < window.queryResAnormalIndecates.length; i++) {
            let value = Boolean(window.customSelection.indexOf(window.queryResAnormalIndecates[i]) !== -1)
            confirmInfo.push(value)
            if (value && window.previousIndecates.indexOf(window.queryResAnormalIndecates[i]) === -1) {
              window.previousIndecates.push(window.queryResAnormalIndecates[i])
            }
          }
          let AnormalyStrategy = 'Feedback'
          // if is control group
          if (window.sessionStorage.isControlGroup == 'true') {
            AnormalyStrategy = 'TBSampling'
          }
          this.projector.queryAnormalyStrategy(

            Number(this.moreRecommednNum), this.selectedAnormalyClass, window.queryResAnormalIndecates, confirmInfo, window.acceptIndicates, window.rejectIndicates, AnormalyStrategy, false,
            (indices: any, cleansIndices: any) => {
              if (indices != null) {
                // this.queryIndices = indices;
                if (this.queryIndices.length == 0) {
                  this.searchBox.message = '0 matches.';
                } else {
                  this.searchBox.message = `${this.queryIndices.length} matches.`;
                }

                window.queryResAnormalIndecates = indices
                window.queryResAnormalCleanIndecates = cleansIndices

                this.queryIndices = indices.concat(cleansIndices)


                if (!this.isAlSelecting) {
                  this.isAlSelecting = true
                  window.isAdjustingSel = true
                  // this.boundingSelectionBtn.classList.add('actived')
                  this.projectorEventContext.setMouseMode(MouseMode.AREA_SELECT)
                }
                // this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(MouseMode.AREA_SELECT);
                this.showCheckAllQueryRes = true
                this.showMoreRecommend = true
                // if (window.sessionStorage.isControlGroup == 'true') {
                //   this.showMoreRecommend = false
                // } else {
                //   this.showMoreRecommend = true
                // }
                this.checkAllQueryRes = false
                this.queryResultListTitle = 'Possible Abnormal Point List'
                // let dom = this.$$("#queryResheader")

                // dom.innerHTML = 'label'
                this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isAnormalyQuery');
              }
            })

        }
      }
    }
    let DVIServer = window.sessionStorage.ipAddress;
    let basePath = window.modelMath
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');

    window.suggestionIndicates = []
    window.checkboxDom = []
    window.acceptInputList = []
    window.rejectInputList = []
    if (!window.acceptIndicates) {
      window.acceptIndicates = []
    }
    if (!window.rejectIndicates) {
      window.rejectIndicates = []
    }


    const queryListTable = document.createElement('table');
    queryListTable.className = 'resTable'
    if (this.showCheckAllQueryRes === true) {
      this.accAllRadio = this.$$('#accAllRadio') as any;
      this.rejAllRadio = this.$$('#rejAllRadio') as any;
      // if (this.accAllRadio && this.rejAllRadio) {
      // setTimeout(()=>{
      this.accAllRadio.addEventListener('change', (e) => {
        console.log('acc e', this.accAllRadio.checked)
        if (this.accAllRadio.checked) {
          for (let i = 0; i < indices.length; i++) {
            window.acceptInputList[indices[i]].checked = true
            window.rejectInputList[indices[i]].checked = false
            if (window.acceptIndicates.indexOf(indices[i]) === -1) {
              window.acceptIndicates.push(indices[i])
            }
            if (window.rejectIndicates.indexOf(indices[i]) !== -1) {
              let index = window.rejectIndicates.indexOf(indices[i])
              window.rejectIndicates.splice(index, 1)
            }
          }
        }

        window.customSelection = window.rejectIndicates.concat(window.acceptIndicates)
        this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
        this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
        this.updateSessionStorage()
        this.projectorEventContext.refresh()
      })
      this.rejAllRadio.addEventListener('change', (e) => {
        console.log('rej e', this.rejAllRadio.checked)
        for (let i = 0; i < indices.length; i++) {
          window.acceptInputList[indices[i]].checked = false
          window.rejectInputList[indices[i]].checked = true
          if (window.rejectIndicates.indexOf(indices[i]) === -1) {
            window.rejectIndicates.push(indices[i])
          }
          if (window.acceptIndicates.indexOf(indices[i]) !== -1) {
            let index = window.acceptIndicates.indexOf(indices[i])
            window.acceptIndicates.splice(index, 1)
          }
        }
        window.customSelection = window.rejectIndicates.concat(window.acceptIndicates)
        this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
        this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
        this.updateSessionStorage()
        this.projectorEventContext.refresh()
      })
      // })

      // }
    }
    if (indices.length > 2000) {
      indices.length = 2000
    }
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const row = document.createElement('th');
      row.className = 'row';

      // const rowLink = document.createElement('a');
      // rowLink.className = 'label';
      // rowLink.title = label;
      // rowLink.innerHTML = label;
      row.onmouseenter = () => {
        this.projectorEventContext.notifyHoverOverPoint(index);
      };
      row.onmouseleave = () => {
        this.projectorEventContext.notifyHoverOverPoint(null);
      };
      if (this.showCheckAllQueryRes === true) {

        // let input = document.createElement('input');
        // input.type = 'checkbox'
        // input.setAttribute('id', `resCheckbox${indices[i]}`)
        // if (!window.checkboxDom) {
        //   window.checkboxDom = []
        // }
        // window.checkboxDom[indices[i]] = input
        // input.addEventListener('change', (e) => {
        //   if (!window.customSelection) {
        //     window.customSelection = []
        //   }
        //   if (input.checked) {
        //     if (window.customSelection.indexOf(indices[i]) === -1) {
        //       window.customSelection.push(indices[i])
        //       this.projectorEventContext.refresh()
        //     }
        //   } else {
        //     let index = window.customSelection.indexOf(indices[i])
        //     window.customSelection.splice(index, 1)
        //     this.projectorEventContext.refresh()
        //   }
        //   this.projectorEventContext.notifyHoverOverPoint(indices[i]);
        // })

        // if (window.customSelection.indexOf(indices[i]) !== -1 && !input.checked) {
        //   input.checked = true
        // }
        // let newtd = document.createElement('td')
        // if(window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(index)!==-1){
        //   input.disabled = true
        //   input.style.visibility = 'hidden'
        // }
        // newtd.appendChild(input)
        // newtd.className = 'inputColumn'
        // newtd.appendChild(input)
        // row.appendChild(newtd)

        let newacctd: any = document.createElement('td')
        let accInput: any = document.createElement('input');
        accInput.setAttribute('name', `op${index}`)
        accInput.setAttribute('id', `accept${index}`)
        accInput.setAttribute('type', `radio`)
        accInput.className = 'inputColumn';
        accInput.setAttribute('value', `accept`)
        window.acceptInputList[indices[i]] = accInput
        newacctd.append(accInput)
        if (window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(index) !== -1) {
          let span = document.createElement('span');
          span.innerText = " "
          let newtd: any = document.createElement('td')
          newtd.style.width = "50px"
          newtd.append(span)

          row.appendChild(newtd)
        } else {
          row.appendChild(newacctd)
        }



        accInput.addEventListener('mouseup', (e: any) => {
          if (accInput.checked) {
            // accInput.prop("checked", false);
            accInput.checked = false
            window.acceptIndicates.splice(window.acceptIndicates.indexOf(index), 1)
          }
          // if(newacctd.)
        })
        accInput.addEventListener('change', () => {


          if (accInput.checked) {
            if (window.acceptIndicates.indexOf(index) === -1) {
              window.acceptIndicates.push(index)
            }
            if (window.rejectIndicates.indexOf(index) !== -1) {
              window.rejectIndicates.splice(window.rejectIndicates.indexOf(index), 1)
            }
            this.accAllRadio.checked = false
            this.rejAllRadio.checked = false

          } else {
            if (window.acceptIndicates.indexOf(index) !== -1) {
              window.acceptIndicates.splice(window.acceptIndicates.indexOf(index), 1)
            }
          }
          window.customSelection = window.acceptIndicates.concat(window.rejectIndicates)
          this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
          this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
          this.updateSessionStorage()
          this.projectorEventContext.refresh()
  
        })


        let newrejtd = document.createElement('td')
        let rejectInput = document.createElement('input');
        window.rejectInputList[indices[i]] = rejectInput
        rejectInput.setAttribute('type', `radio`)
        rejectInput.setAttribute('name', `op${index}`)
        accInput.setAttribute('id', `reject${index}`)
        rejectInput.setAttribute('value', `reject`)
        newrejtd.append(rejectInput)
        if (window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(index) !== -1) {
          let span = document.createElement('span');
          span.innerText = "  "
          let newtd: any = document.createElement('td')
          newtd.style.width = "50px"
          newtd.append(span)
          row.appendChild(newtd)
        } else {
          row.appendChild(newrejtd)
        }


        rejectInput.addEventListener('change', () => {
          if (rejectInput.checked) {
            if (window.rejectIndicates.indexOf(index) === -1) {
              window.rejectIndicates.push(index)
            }
            if (window.acceptIndicates.indexOf(index) !== -1) {
              console.log(window.acceptIndicates.indexOf(index))
              window.acceptIndicates.splice(window.acceptIndicates.indexOf(index), 1)
            }
            this.accAllRadio.checked = false
            this.rejAllRadio.checked = false

          } else {
            if (window.rejectIndicates.indexOf(index) !== -1) {
              window.rejectIndicates.splice(window.rejectIndicates.indexOf(index), 1)
            }
          }
          window.customSelection = window.acceptIndicates.concat(window.rejectIndicates)
          this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
          this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
          this.updateSessionStorage()
          this.projectorEventContext.refresh()
        })

        // row.appendChild(input);
      }
      const label = this.getLabelFromIndex(index);
      let arr = label.split("|")
      for (let i = 0; i < arr.length; i++) {
        let newtd = document.createElement('td');
        newtd.className = 'queryResColumn';
        newtd.innerText = arr[i]
        row.appendChild(newtd)
      }


      row.onmouseenter = async () => {
        await fetch(`http://${DVIServer}/sprite?index=${indices[i]}&path=${basePath}&username=${window.sessionStorage.username}`, {
          method: 'GET',
          mode: 'cors'
        }).then(response => response.json()).then(data => {
          // console.log("response", data);
          let imgsrc = data.imgUrl;
          // this.projectorEventContext.updateMetaDataByIndices(indices[i], imgsrc)
          this.projectorEventContext.notifyHoverOverPoint(index);
          // logging.setModalMessage(null, msgId);
        }).catch(error => {
          console.log("error", error);
        });

      };
      row.onmouseleave = () => {
        // this.projectorEventContext.updateMetaDataByIndices(-1, '')
        this.projectorEventContext.notifyHoverOverPoint(null);
      };

      row.className = 'row-img';
      // row.appendChild(rowLink);
      queryListTable.appendChild(row)
      list.appendChild(queryListTable);
    }
  }
  updateSessionStorage() {
    console.log('update session')
    window.sessionStorage.setItem('acceptIndicates', window.acceptIndicates.join(","))
    window.sessionStorage.setItem('rejectIndicates', window.rejectIndicates.join(","))
    window.sessionStorage.setItem('customSelection', window.customSelection.join(","))
  }
  private getLabelFromIndex(pointIndex: number): string {
    if (!window.flagindecatesList) {
      window.flagindecatesList = []
    }
    const metadata = this.projector.dataSet.points[pointIndex].metadata[
      this.selectedMetadataField
    ];
    let prediction = this.projector.dataSet.points[pointIndex]?.current_prediction;
    if (prediction == undefined) {
      prediction = `Unknown`;
    }

    let original_label = this.projector.dataSet.points[pointIndex].original_label;
    if (original_label == undefined) {
      original_label = `Unknown`;
    }
    let index = window.queryResPointIndices?.indexOf(pointIndex)

    let suggest_label = this.labelMap[window.alSuggestLabelList[index]]


    if (original_label == undefined) {
      original_label = `Unknown`;
    }
    let score = window.alSuggestScoreList[index]?.toFixed(3)
    const stringMetaData = metadata !== undefined ? String(metadata) : `Unknown #${pointIndex}`;

    const displayprediction = prediction
    const displayStringMetaData = stringMetaData

    const displayPointIndex = String(pointIndex)
    // return String(pointIndex) + "Label: " + stringMetaData + " Prediction: " + prediction + " Original label: " + original_label;
    let prediction_res = suggest_label === prediction || window.alSuggestLabelList.length === 0 ? ' - ' : ' ❗️ '
    if (window.queryResAnormalCleanIndecates && window.queryResAnormalCleanIndecates.indexOf(pointIndex) !== -1) {
      return `${displayPointIndex}|${displayStringMetaData}| majority`
    }
    if (window.queryResAnormalIndecates && window.queryResAnormalIndecates.indexOf(pointIndex) !== -1) {
      let prediction_res = suggest_label === displayStringMetaData ? ' - ' : ' ❗️ '

      if (window.sessionStorage.isControlGroup == 'true') {
        return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`
      } else {
        if (prediction_res !== " - ") {
          if (window.flagindecatesList.indexOf(pointIndex) === -1) {
            window.flagindecatesList.push(pointIndex)
          }
        }
        // return `${displayPointIndex}|${displayStringMetaData}|${prediction_res}|${score !== undefined ? score : '-'}`
        return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`
      }

    }
    if (this.showCheckAllQueryRes == false) {
      if (window.sessionStorage.isControlGroup == 'true') {
        return `${displayPointIndex}|${displayprediction}`
      } else {
        if (prediction_res !== " - ") {
          if (window.flagindecatesList.indexOf(pointIndex) === -1) {
            window.flagindecatesList.push(pointIndex)
          }
        }
        return `${displayPointIndex}|${displayprediction}`
      }
    }
    if (window.sessionStorage.isControlGroup == 'true') {
      return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`
    } else {
      if (prediction_res !== " - ") {
        if (window.flagindecatesList.indexOf(pointIndex) === -1) {
          window.flagindecatesList.push(pointIndex)
        }
      }
      // return `${displayPointIndex}|${displayprediction}|${prediction_res}|${score !== undefined ? score : '-'}`
      return `${displayPointIndex}|${displayprediction}|${score !== undefined ? score : '-'}`
    }
  }
  private getnnLabelFromIndex(pointIndex: number): string {
    const metadata = this.projector.dataSet.points[pointIndex].metadata[
      this.selectedMetadataField
    ];
    let prediction = this.projector.dataSet.points[pointIndex]?.current_prediction;
    if (prediction == undefined) {
      prediction = `Unknown`;
    }
    let original_label = this.projector.dataSet.points[pointIndex].original_label;
    if (original_label == undefined) {
      original_label = `Unknown`;
    }
    if (original_label == undefined) {
      original_label = `Unknown`;
    }
    const stringMetaData = metadata !== undefined ? String(metadata) : `Unknown #${pointIndex}`;
    const displayprediction = prediction
    const displayStringMetaData = stringMetaData
    const displayPointIndex = String(pointIndex)
    // return String(pointIndex) + "Label: " + stringMetaData + " Prediction: " + prediction + " Original label: " + original_label;
    let prediction_res = stringMetaData === prediction ? ' - ' : ' ❗️ '
    return `index:${displayPointIndex} | label:${displayStringMetaData}| prediction:${displayprediction} | ${prediction_res}`
  }
  private spriteImageRenderer() {
    const spriteImagePath = this.spriteMeta.imagePath;
    const { aspectRatio, nCols } = this.spriteMeta as any;
    const paddingBottom = 100 / aspectRatio + '%';
    const backgroundSize = `${nCols * 100}% ${nCols * 100}%`;
    const backgroundImage = `url(${CSS.escape(spriteImagePath)})`;
    return (neighbor: knn.NearestEntry): HTMLElement => {
      const spriteElementImage = document.createElement('div');
      spriteElementImage.className = 'sprite-image';
      spriteElementImage.style.backgroundImage = backgroundImage;
      spriteElementImage.style.paddingBottom = paddingBottom;
      spriteElementImage.style.backgroundSize = backgroundSize;
      const [row, col] = [
        Math.floor(neighbor.index / nCols),
        neighbor.index % nCols,
      ];
      const [top, left] = [
        (row / (nCols - 1)) * 100,
        (col / (nCols - 1)) * 100,
      ];
      spriteElementImage.style.backgroundPosition = `${left}% ${top}%`;
      return spriteElementImage;
    };
  }
  updateCurrentPlayEpoch(num: number) {
    this.currentPlayedEpoch = num
  }
  private updateNeighborsList(neighbors?: knn.NearestEntry[]) {
    neighbors = neighbors || this._currentNeighbors;
    this._currentNeighbors = neighbors;
    if (neighbors == null) {
      return;
    }
    const nnlist = this.$$('.nn-list') as HTMLDivElement;
    nnlist.textContent = '';
    if (neighbors.length === 0) {
      this.removeContext('.nn');
      return;
    }
    this.addContext('.nn');
    this.searchBox.message = '';
    const minDist = neighbors.length > 0 ? neighbors[0].dist : 0;
    if (this.spriteImagesAvailable && this.showNeighborImages) {
      var imageRenderer = this.spriteImageRenderer();
    }
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      const neighborElement = document.createElement('div');
      neighborElement.className = 'neighbor';
      const neighborElementLink = document.createElement('a');
      neighborElementLink.className = 'neighbor-link';
      neighborElementLink.title = this.getnnLabelFromIndex(neighbor.index);
      const labelValueElement = document.createElement('div');
      labelValueElement.className = 'label-and-value';
      const labelElement = document.createElement('div');
      labelElement.className = 'label';
      labelElement.style.color = dist2color(
        this.distFunc,
        neighbor.dist,
        minDist
      );
      labelElement.innerText = this.getnnLabelFromIndex(neighbor.index);
      const valueElement = document.createElement('div');
      valueElement.className = 'value';
      valueElement.innerText = this.projector.dataSet.points[neighbor.index]?.current_inv_acc?.toFixed(3);
      labelValueElement.appendChild(labelElement);
      labelValueElement.appendChild(valueElement);
      const barElement = document.createElement('div');
      barElement.className = 'bar';
      const barFillElement = document.createElement('div');
      barFillElement.className = 'fill';
      barFillElement.style.borderTopColor = dist2color(
        this.distFunc,
        neighbor.dist,
        minDist
      );
      barFillElement.style.width =
        normalizeDist(this.distFunc, neighbor.dist, minDist) * 100 + '%';
      barElement.appendChild(barFillElement);
      for (let j = 1; j < 4; j++) {
        const tickElement = document.createElement('div');
        tickElement.className = 'tick';
        tickElement.style.left = (j * 100) / 4 + '%';
        barElement.appendChild(tickElement);
      }
      if (this.spriteImagesAvailable && this.showNeighborImages) {
        const neighborElementImage = imageRenderer(neighbor);
        neighborElement.appendChild(neighborElementImage);
      }
      neighborElementLink.appendChild(labelValueElement);
      neighborElementLink.appendChild(barElement);
      neighborElement.appendChild(neighborElementLink);
      nnlist.appendChild(neighborElement);
      neighborElementLink.onmouseenter = () => {
        this.projectorEventContext.notifyHoverOverPoint(neighbor.index);
      };
      neighborElementLink.onmouseleave = () => {
        this.projectorEventContext.notifyHoverOverPoint(null);
      };
      neighborElementLink.onclick = () => {
        this.projectorEventContext.notifySelectionChanged([neighbor.index]);
      };
    }
  }
  private updateFilterButtons(numPoints: number) {
    if (numPoints) {
      this.setFilterButton.innerText = `Filter ${numPoints}`;
      if (numPoints > 1) {
        this.setFilterButton.disabled = null;
      }
      this.clearSelectionButton.disabled = null;
    } else {
      this.setFilterButton.innerText = `Filter selection`;
      this.setFilterButton.disabled = true;
      this.clearSelectionButton.disabled = true;
    }
  }
  private setupUI(projector: any) {

    const self = this;
    const inkTabs = this.root.querySelectorAll('.ink-tab');
    for (let i = 0; i < inkTabs.length; i++) {
      inkTabs[i].addEventListener('click', function () {
        let id = this.getAttribute('data-tab');
        self.showTab(id);
      });
    }
    if (window)
      if (window.sessionStorage.taskType === 'anormaly detection' && window.sessionStorage.isControlGroup !== 'true'
      ) {
        self.showTab('anomaly');
      } else if (window.sessionStorage.taskType === 'active learning') {
        self.showTab('advanced');
      }
      else {
        self.showTab('normal');
        this.showMoreRecommend = false
        // this.updateSearchResults([]);
      }




    this.queryByStrategtBtn.onclick = () => {
      this.queryByAl(projector, window.acceptIndicates, window.rejectIndicates,this.budget, true)
    }

    // if(this.showSelectionBtn){
    this.showSelectionBtn.onclick = () => {

      for (let i = 0; i < window.previousIndecates?.length; i++) {
        if (window.customSelection.indexOf(window.previousIndecates[i]) === -1) {
          window.customSelection.push(window.previousIndecates[i])
        }
      }
      this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isShowSelected');
      // this.updateSearchResults(this.queryIndices)
    }
    // }
    this.noisyshowSelectionBtn.onclick = () => {
      for (let i = 0; i < window.previousIndecates?.length; i++) {
        if (window.customSelection.indexOf(window.previousIndecates[i]) === -1) {
          window.customSelection.push(window.previousIndecates[i])
        }
      }
      this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isShowSelected');
      // this.updateSearchResults(this.queryIndices)
    }

    this.queryAnomalyBtn.onclick = () => {
      projector.queryAnormalyStrategy(
        Number(this.anomalyRecNum), this.selectedAnormalyClass, [], [], window.acceptIndicates, window.rejectIndicates, 'TBSampling', true,
        (indices: any, cleansIndices: any) => {
          if (indices != null) {
            // this.queryIndices = indices;
            if (this.queryIndices.length == 0) {
              this.searchBox.message = '0 matches.';
            } else {
              this.searchBox.message = `${this.queryIndices.length} matches.`;
            }

            window.queryResAnormalIndecates = indices
            window.queryResAnormalCleanIndecates = cleansIndices

            this.queryIndices = indices.concat(cleansIndices)
            if (!this.isAlSelecting) {
              this.isAlSelecting = true
              window.isAdjustingSel = true
              // this.boundingSelectionBtn.classList.add('actived')
              this.projectorEventContext.setMouseMode(MouseMode.AREA_SELECT)
            }
            // this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(MouseMode.AREA_SELECT);
            this.showCheckAllQueryRes = true
            this.showMoreRecommend = true
            // if (window.sessionStorage.isControlGroup == 'true') {
            //   this.showMoreRecommend = false
            // } else {
            //   this.showMoreRecommend = true
            // }
            this.checkAllQueryRes = false
            this.queryResultListTitle = 'Possible Abnormal Point List'
            // let dom = this.$$("#queryResheader")

            // dom.innerHTML = 'label'
            this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isAnormalyQuery');
          }
        })
    }


    this.trainBySelBtn.onclick = () => {
      if (window.acceptIndicates?.length < 500) {
        logging.setErrorMessage(`Current selected interested samples: ${window.acceptIndicates?.length},
          Please Select 500 interest samples`);
        return
      }
      this.resetStatus()
      // this.boundingSelectionBtn.classList.remove('actived')
      // this.projectorEventContext.setMouseMode(MouseMode.CAMERA_AND_CLICK_SELECT);
      // console.log(window.cus)
      let retrainList = window.previousIndecates
      retrainList
      for (let i = 0; i < window.customSelection.length; i++) {
        if (window.previousIndecates.indexOf(window.customSelection[i]) === -1) {
          retrainList.push(window.customSelection[i])
        }
      }
      function func(a, b) {
        return a - b;
      }
      retrainList.sort(func)
      this.projector.retrainBySelections(this.projector.iteration, window.acceptIndicates, window.rejectIndicates)
      //  this.projectionsPanel.reTrainBySel(this.projector.iteration,this.selectedPointIndices)
    }
    this.distFunc = vector.cosDist;
    const eucDist = this.$$('.distance a.euclidean') as HTMLLinkElement;
    eucDist.onclick = () => {
      const links = this.root.querySelectorAll('.distance a');
      for (let i = 0; i < links.length; i++) {
        util.classed(links[i] as HTMLElement, 'selected', false);
      }
      util.classed(eucDist as HTMLElement, 'selected', true);
      this.distFunc = vector.dist;
      this.projectorEventContext.notifyDistanceMetricChanged(this.distFunc);
      const neighbors = projector.dataSet.findNeighbors(
        this.selectedPointIndices[0],
        this.distFunc,
        this.numNN
      );
      this.updateNeighborsList(neighbors);
    };
    const cosDist = this.$$('.distance a.cosine') as HTMLLinkElement;
    cosDist.onclick = () => {
      const links = this.root.querySelectorAll('.distance a');
      for (let i = 0; i < links.length; i++) {
        util.classed(links[i] as HTMLElement, 'selected', false);
      }
      util.classed(cosDist, 'selected', true);
      this.distFunc = vector.cosDist;
      this.projectorEventContext.notifyDistanceMetricChanged(this.distFunc);
      const neighbors = projector.dataSet.findNeighbors(
        this.selectedPointIndices[0],
        this.distFunc,
        this.numNN
      );
      this.updateNeighborsList(neighbors);
    };


    this.noisyBtn.onclick = () => {

      if (window.customSelection.length == 0) {
        alert('please confirm some points first')
        return
      }
      window.isAnimatating = true
      projector.getAllResPosList((data: any) => {
        if (data && data.results) {
          window.allResPositions = data
          this.totalEpoch = Object.keys(data.results).length
          this.projectorEventContext.setDynamicNoisy()
          this.noisyBtn.disabled = true;
          this.stopBtn.disabled = false;
        }
      })
    }


    this.stopBtn.onclick = () => {
      window.isAnimatating = false
      this.projectorEventContext.setDynamicStop()
      this.noisyBtn.disabled = false;
      this.stopBtn.disabled = true;
      // this.projectorEventContext.renderInTraceLine(false, 1, 1)
      if (window.lineGeomertryList?.length) {
        for (let i = 0; i < window.lineGeomertryList; i++) { window.lineGeomertryList[i].parent.remove(window.lineGeomertryList[i]) }
      }
    }

    this.enableResetFilterButton(false);

    const updateInput = (value: string, inRegexMode: boolean) => {
      this.searchPredicate = value;
      this.searchInRegexMode = inRegexMode
    };
    this.searchBox.registerInputChangedListener((value, inRegexMode) => {
      updateInput(value, inRegexMode);
    });
    this.searchButton.onclick = () => {
      // read search box input and update indices

      if (this.searchPredicate == null || this.searchPredicate.trim() === '') {
        this.searchBox.message = '';
        this.projectorEventContext.notifySelectionChanged([]);
        return;
      }

      projector.query(
        this.searchPredicate,
        this.searchInRegexMode,
        this.selectedMetadataField,
        this.currentPredicate,
        this.projector.iteration,
        this.confidenceThresholdFrom,
        this.confidenceThresholdTo,
        (indices: any) => {
          if (indices != null) {
            this.queryIndices = indices;
            if (this.queryIndices.length == 0) {
              this.searchBox.message = '0 matches.';
            } else {
              this.searchBox.message = `${this.queryIndices.length} matches.`;
            }
            this.showCheckAllQueryRes = true
            this.showMoreRecommend = false
            this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'normal');
            this.queryResultListTitle = 'Query Result List'
          }
        }
      );
    }
  
  }



  private queryByAl(projector, acceptIndicates, rejectIndicates, querNum?, isRecommend?) {
    let that = this
    let num = Number(this.budget)
    let stratergy = this.selectedStratergy
    if (this.selectedStratergy === 'Interest potential') {
      stratergy = 'TBSampling'
    }
    if (querNum) {
      num = Number(querNum)
    }
    if (isRecommend === false) {
      if (window.sessionStorage.isControlGroup == 'true') {
        stratergy = 'TBSampling'
      } else {
        stratergy = 'Feedback'
      }
    }
    if (!acceptIndicates) {
      acceptIndicates = []
    }
    if (!rejectIndicates) {
      rejectIndicates = []
    }
    projector.queryByAL(
      this.projector.iteration,
      stratergy,
      num,
      acceptIndicates,
      rejectIndicates,
      isRecommend,
      (indices: any, scores: any, labels: any) => {
        if (indices != null) {
          this.queryIndices = indices;
          if (this.queryIndices.length == 0) {
            this.searchBox.message = '0 matches.';
          } else {
            this.searchBox.message = `${this.queryIndices.length} matches.`;
          }

          window.alSuggestScoreList = scores
          window.alSuggestLabelList = labels

          if (!this.isAlSelecting) {
            this.isAlSelecting = true
            window.isAdjustingSel = true
            // this.boundingSelectionBtn.classList.add('actived')
            this.projectorEventContext.setMouseMode(MouseMode.AREA_SELECT)
          }
          this.showCheckAllQueryRes = true
          this.showMoreRecommend = true
          // if (window.sessionStorage.isControlGroup == 'true') {
          //   this.showMoreRecommend = false
          // } else {
          //   this.showMoreRecommend = true
          // }
          this.checkAllQueryRes = false
          this.queryResultListTitle = 'Active Learning suggestion'
          let dom = this.$$("#queryResheader")
          dom.innerHTML = 'predict'
          this.projectorEventContext.notifySelectionChanged(this.queryIndices, false, 'isALQuery');
          // this.projectorScatterPlotAdapter.scatterPlot.setMouseMode(MouseMode.AREA_SELECT);

        }
      }
    );
  }

  resetStatus() {
    this.isAlSelecting = false
    window.isAdjustingSel = false
  }

  playAnimationFinished() {
    this.noisyBtn.disabled = false;
    this.stopBtn.disabled = true;
  }

  public showTab(id: string) {
    this.currentFilterType = id;
    const tab = this.$$('.ink-tab[data-tab="' + id + '"]') as HTMLElement;
    const allTabs = this.root.querySelectorAll('.ink-tab');
    for (let i = 0; i < allTabs.length; i++) {
      util.classed(allTabs[i] as HTMLElement, 'active', false);
    }
    util.classed(tab, 'active', true);
    const allTabContent = this.root.querySelectorAll('.ink-panel-content');
    for (let i = 0; i < allTabContent.length; i++) {
      util.classed(allTabContent[i] as HTMLElement, 'active', false);
    }
    util.classed(
      this.$$('.ink-panel-content[data-panel="' + id + '"]') as HTMLElement,
      'active',
      true
    );
    // guard for unit tests, where polymer isn't attached and $ doesn't exist.
    if (this.$ != null) {
      const main = this.$['main'];
      // In order for the projections panel to animate its height, we need to
      // set it explicitly.
      requestAnimationFrame(() => {
        this.style.height = main?.clientHeight + 'px';
      });
    }
    if(id === 'normal'){
      this.showMoreRecommend = false
    }
    this.updateSearchResults([]);
    window.alSuggestScoreList = []
    console.log('id',id);
  }


  updateDisabledStatues(value: boolean) {
    this.disabledAlExBase = value
  }



  updateBoundingBoxSelection(indices: number[]) {
    this.currentBoundingBoxSelection = indices;
    if (!window.customSelection) {
      window.customSelection = []
    }

    for (let i = 0; i < this.currentBoundingBoxSelection.length; i++) {
      if (window.customSelection.indexOf(this.currentBoundingBoxSelection[i]) < 0) {
        window.customSelection.push(this.currentBoundingBoxSelection[i]);
      } else {
        let index = window.customSelection.indexOf(this.currentBoundingBoxSelection[i])
        window.customSelection.splice(index, 1)
      }
    }
    this.noisyBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
    this.stopBtn.style.visibility = Boolean(window.customSelection?.length)?'':'hidden'
    // window.customSelection = this.currentBoundingBoxSelection
  }
  private updateNumNN() {
    if (this.selectedPointIndices != null) {
      this.projectorEventContext.notifySelectionChanged([
        this.selectedPointIndices[0],
      ]);
    }
  }
}
