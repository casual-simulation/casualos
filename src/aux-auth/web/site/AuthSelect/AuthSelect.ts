import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide } from 'vue-property-decorator';
import { authManager } from '../../shared/AuthManager';

@Component({
    components: {},
})
export default class AuthSelect extends Vue {
    service: string;
    processing: boolean;

    @Prop() defaultService: string;

    created() {
        this.service = '';
        this.processing = false;

        if (this.defaultService) {
            this.service = this.defaultService;
        }
    }

    redirectToLogin() {
        this.$router.replace({ name: 'login', query: { after: 'select' } });
    }

    async submit() {
        this.processing = true;
        try {
            if (await authManager.magic.user.isLoggedIn()) {
                const token = await authManager.authorizeService(this.service);

                this.$router.push({ name: 'home' });
            } else {
                this.redirectToLogin();
            }
        } finally {
            this.processing = false;
        }
    }

    // private async _loadInfoAndNavigate() {
    //     if (this._loggedIn) {
    //         await authManager.loadUserInfo();
    //         this.$router.push({ name: 'home' });
    //     }
    // }

    // async login() {
    //     if (!this.email) {
    //         return;
    //     }
    //     this.processing = true;

    //     try {
    //         if (await authManager.magic.user.isLoggedIn()) {
    //             this._loggedIn = true;
    //         } else {
    //             await this._loginWithEmail();
    //         }
    //     } finally {
    //         this.processing = false;
    //         await this._loadInfoAndNavigate();
    //     }
    // }

    // private async _loginWithEmail() {
    //     try {
    //         await authManager.magic.auth.loginWithMagicLink({
    //             email: PRODUCTION ? this.email : 'test+success@magic.link',
    //         });
    //         this._loggedIn = true;
    //     } catch (err) {
    //         this._loggedIn = false;
    //         // TODO: Handle errors
    //         // if (err instanceof RPCError) {
    //         //     switch(err.code) {
    //         //         case RPCErrorCode.
    //         //     }
    //         // }
    //     }
    // }
}
