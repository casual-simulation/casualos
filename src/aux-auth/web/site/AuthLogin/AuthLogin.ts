import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide } from 'vue-property-decorator';
import { authManager } from '../../shared/AuthManager';

@Component({
    components: {},
})
export default class AuthLogin extends Vue {
    email: string;
    processing: boolean;

    private _loggedIn: boolean;

    async created() {
        this.email = authManager.savedEmail || '';
        this.processing = false;
        this._loggedIn = false;
    }

    async mounted() {
        if (await authManager.magic.user.isLoggedIn()) {
            this._loggedIn = true;
        }

        await this._loadInfoAndNavigate();
    }

    private async _loadInfoAndNavigate() {
        if (this._loggedIn) {
            await authManager.loadUserInfo();
            this.$router.push({ name: 'home' });
        }
    }

    async login() {
        if (!this.email) {
            return;
        }
        this.processing = true;

        try {
            if (await authManager.magic.user.isLoggedIn()) {
                this._loggedIn = true;
            } else {
                await this._loginWithEmail();
            }
        } finally {
            this.processing = false;
            await this._loadInfoAndNavigate();
        }
    }

    private async _loginWithEmail() {
        try {
            await authManager.magic.auth.loginWithMagicLink({
                email: PRODUCTION ? this.email : 'test+success@magic.link',
            });
            this._loggedIn = true;
        } catch (err) {
            this._loggedIn = false;
            // TODO: Handle errors
            // if (err instanceof RPCError) {
            //     switch(err.code) {
            //         case RPCErrorCode.
            //     }
            // }
        }
    }
}
