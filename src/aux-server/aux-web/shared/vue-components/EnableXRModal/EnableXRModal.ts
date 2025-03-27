/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import Vue from 'vue';
import Component from 'vue-class-component';
import { EventBus } from '@casual-simulation/aux-components';

export interface EnableXRModalRequestParameters {
    mode: 'immersive-vr' | 'immersive-ar';
    onConfirm: () => void;
    onCancel: () => void;
}

@Component({})
export default class EnableXRModal extends Vue {
    private _requestParameters: EnableXRModalRequestParameters;

    showDialog: boolean = false;
    title: string = '';
    content: string = '';

    constructor() {
        super();
    }

    created() {
        this._onRequestXR = this._onRequestXR.bind(this);

        EventBus.$on('requestXR', this._onRequestXR);
    }

    beforeDestroy() {
        EventBus.$off('requestXR', this._onRequestXR);
    }

    onConfirm() {
        if (this._requestParameters) {
            this._requestParameters.onConfirm();
        }
    }

    onCancel() {
        if (this._requestParameters) {
            this._requestParameters.onCancel();
        }
    }

    private _onRequestXR(parameters: EnableXRModalRequestParameters) {
        this._requestParameters = parameters;

        if (this._requestParameters.mode === 'immersive-ar') {
            this.title = 'Enable AR?';
            this.content = 'Do you want to enable Augmented Reality (AR)?';
        } else {
            this.title = 'Enable VR?';
            this.content = 'Do you want to enable Virtual Reality (VR)?';
        }

        this.showDialog = true;
    }
}
