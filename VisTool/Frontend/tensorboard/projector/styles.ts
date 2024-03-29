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
import {registerStyleDomModule} from '../components/polymer/register_style_dom_module';

registerStyleDomModule({
  moduleName: 'vz-projector-styles',
  styleContent: `
    :host {
      --paper-input-container-label: {
        font-size: 14px;
      }
      --paper-input-container-input: {
        font-size: 14px;
      }
      /* TODO: Figure out why this doesn't work */
      --paper-dropdown-menu-input: {
        font-size: 14px;
      }
    }

    paper-button {
      background: #e3e3e3;
      margin-left: 0;
      text-transform: none;
    }

    paper-dropdown-menu paper-item {
      font-size: 13px;
    }

    paper-tooltip {
      max-width: 200px;
      --paper-tooltip: {
        font-size: 12px;
      }
    }

    paper-checkbox {
      --paper-checkbox-checked-color: #880e4f;
    }

    paper-toggle-button {
      --paper-toggle-button-checked-bar-color: #880e4f;
      --paper-toggle-button-checked-button-color: #880e4f;
      --paper-toggle-button-checked-ink-color: #880e4f;
    }

    paper-icon-button {
      border-radius: 50%;
    }

    paper-icon-button[active] {
      color: white;
      background-color: #880e4f;
    }

    .slider {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      justify-content: space-between;
    }

    .slider span {
      width: 35px;
      text-align: right;
    }

    .slider label {
      align-items: center;
      display: flex;
    }

    .help-icon {
      height: 15px;
      left: 2px;
      min-width: 15px;
      min-height: 15px;
      margin: 0;
      padding: 0;
      top: -2px;
      width: 15px;
    }

    .ink-panel {
      display: flex;
      flex-direction: column;
      font-size: 14px;
    }

    .ink-panel h4 {
      border-bottom: 1px solid #ddd;
      font-size: 14px;
      font-weight: 500;
      margin: 0;
      margin-bottom: 10px;
      padding-bottom: 5px;
    }

    .ink-panel-header {
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      height: 50px;
    }

    .ink-panel-content {
      display: none;
      height: 100%;
    }

    .ink-panel-content.active {
      display: block;
    }

    .ink-panel-content h3 {
      font-weight: 500;
      font-size: 14px;
      margin-top: 20px;
      margin-bottom: 5px;
      // text-transform: uppercase;
    }

    .ink-panel-header h3 {
      font-weight: 500;
      font-size: 14px;
      margin: 0;
      padding: 0 24px;
      // text-transform: uppercase;
    }

    /* - Tabs */
    .ink-tab-group {
      align-items: center;
      box-sizing: border-box;
      display: flex;
      height: 100%;
      justify-content: space-around;
    }

    .ink-tab-group .projection-tab {
      color: rgba(0, 0, 0, 0.5);
      cursor: pointer;
      font-weight: 300;
      line-height: 20px;
      padding: 0 12px;
      text-align: center;
      text-transform: none;
    }

    .ink-tab-group .projection-tab:hover {
      color: black;
    }

    .ink-tab-group .projection-tab.active {
      border-bottom: 2px solid black;
      color: black;
      font-weight: 500;
    }

    h4 {
      margin: 30px 0 10px 0;
    }

    .dismiss-dialog-note {
      margin-top: 25px;
      font-size: 11px;
      text-align: right;
    }
  `,
});
