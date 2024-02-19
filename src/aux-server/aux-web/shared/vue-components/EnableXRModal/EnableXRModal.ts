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
