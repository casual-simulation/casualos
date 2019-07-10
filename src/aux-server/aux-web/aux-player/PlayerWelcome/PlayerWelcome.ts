import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import Axios from 'axios';
import { appManager } from '../../shared/AppManager';
import uuid from 'uuid/v4';

@Component
export default class PlayerWelcome extends Vue {
    users: AuxUser[] = [];

    email: string = '';
    grant: string = '';

    showList: boolean = true;
    showProgress: boolean = false;

    showCreateAccount: boolean = false;
    showQRCode: boolean = false;

    get contextId(): string {
        return <string>(this.$route.query.context || '');
    }

    get channelId(): string {
        return <string>(this.$route.query.id || '');
    }

    async created() {
        this.users = (await appManager.getUsers()).filter(u => !u.isGuest);

        if (this.users.length === 0) {
            this.showList = false;
            this.showCreateAccount = true;
        }
    }

    createUser() {
        console.log('[BuilderWelcome] Email submitted: ' + this.email);
        this._login(this.email);
    }

    continueAsGuest() {
        this._login(`guest_${uuid()}`);
    }

    createAccount() {
        this.showCreateAccount = true;
        this.showList = false;
    }

    addAccount() {
        this.showCreateAccount = false;
        this.showList = false;
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
        console.log(grant);
        const err = await appManager.loginOrCreateUser(
            username,
            this.channelId,
            grant
        );
        if (!err) {
            this.$router.push({
                name: 'home',
                params: { id: this.channelId || null },
            });
        } else {
            this.showProgress = false;

            if (err.type === 'login' && err.reason === 'wrong_token') {
                this.showQRCode = true;
                this.showCreateAccount = false;
                this.showList = false;
            }
        }
    }
}
