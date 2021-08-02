import { UserMetadata } from '../../../shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide } from 'vue-property-decorator';
import { authManager } from '../AuthManager';
import { Subscription } from 'rxjs';

@Component({
    components: {},
})
export default class AuthHome extends Vue {
    metadata: UserMetadata = null;
    originalEmail: string = null;

    private _sub: Subscription;

    created() {
        this.metadata = null;
    }

    mounted() {
        this._sub = authManager.loginState.subscribe((state) => {
            this.originalEmail = authManager.email;
            this.metadata = {
                email: authManager.email,
                avatarUrl: authManager.avatarUrl,
                name: authManager.name,
            };
        });
    }

    beforeDestroy() {
        this._sub?.unsubscribe();
    }

    saveEmail() {
        // TODO: Handle errors
        authManager.changeEmail(this.metadata.email);
    }
}
