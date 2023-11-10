import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import QrcodeStream from 'vue-qrcode-reader/src/components/QrcodeStream';

@Component({
    components: {
        'qrcode-stream': QrcodeStream,
    },
})
export default class AuthorizeAccountPopup extends Vue {
    @Prop({ required: true }) show: boolean;
    code: string = '';

    private _sim: BrowserSimulation;

    @Watch('show')
    visibleChanged() {
        this._sim = appManager.simulationManager.primary;
    }

    close() {
        this.$emit('close');
    }

    async cancel() {
        this.close();
    }

    onQRCodeScanned(code: string) {
        this._grant(code);
    }

    continueWithCode() {
        this._grant(this.code);
    }

    private _grant(token: string) {
        // return this._sim.login.setGrant(token);
    }
}
