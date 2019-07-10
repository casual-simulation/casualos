import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import Axios from 'axios';
import { appManager } from '../../shared/AppManager';
import uuid from 'uuid/v4';
import { QrcodeStream } from 'vue-qrcode-reader';
import { AuxUser } from '@casual-simulation/aux-vm';

@Component({
    components: {
        'qrcode-stream': QrcodeStream,
    },
})
export default class BuilderWelcome extends Vue {
    users: AuxUser[] = [];

    email: string = '';
    grant: string = '';
    showProgress: boolean = false;

    shouldCreateAccount: boolean = false;

    needsGrant: boolean = false;

    get channelId(): string {
        return <string>(this.$route.query.id || '');
    }

    async created() {
        this.users = await appManager.getUsers();
    }

    createUser() {
        console.log('[BuilderWelcome] Email submitted: ' + this.email);
        this._login(this.email);
    }

    continueAsGuest() {
        this._login(`guest_${uuid()}`);
    }

    createAccount() {
        this.shouldCreateAccount = true;
    }

    signIn(user: AuxUser) {
        this._login(user.username);
    }

    onQrCodeScannerClosed() {}

    onQRCodeScanned(code: string) {
        this._login(this.email, code);
    }

    private async _login(username: string, grant?: string) {
        this.showProgress = true;
        const err = await appManager.loginOrCreateUser(
            username,
            this.channelId
        );
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
