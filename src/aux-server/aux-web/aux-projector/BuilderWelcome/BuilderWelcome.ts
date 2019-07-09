import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import Axios from 'axios';
import { appManager } from '../../shared/AppManager';
import uuid from 'uuid/v4';
import { QrcodeStream } from 'vue-qrcode-reader';

@Component({
    components: {
        'qrcode-stream': QrcodeStream,
    },
})
export default class BuilderWelcome extends Vue {
    email: string = '';
    showProgress: boolean = false;

    needsGrant: boolean = false;
    showQRScanner: boolean = false;

    get channelId(): string {
        return <string>(this.$route.query.id || '');
    }

    createUser() {
        console.log('[BuilderWelcome] Email submitted: ' + this.email);
        this._login(this.email);
    }

    continueAsGuest() {
        this._login(`guest_${uuid()}`);
    }

    scanGrant() {
        this.showQRScanner = true;
    }

    onQrCodeScannerClosed() {}

    onQRCodeScanned(code: string) {
        this._login(this.email, code);
        this.showQRScanner = false;
    }

    hideQRCodeScanner() {
        this.showQRScanner = false;
    }

    private async _login(email: string, grant?: string) {
        this.showProgress = true;
        const err = await appManager.loginOrCreateUser(email, this.channelId);
        if (!err) {
            this.$router.push({
                name: 'home',
                params: { id: this.channelId || null },
            });
        } else {
            this.showProgress = false;

            if (err.type === 'login' && err.reason === 'wrong_token') {
                this.needsGrant = true;
            }
        }
    }
}
