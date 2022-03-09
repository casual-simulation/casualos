import { AppMetadata, UserMetadata } from '../../../shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/AuthManager';
import { Subscription } from 'rxjs';
import { debounce } from 'lodash';
import Avatar from '../AuthAvatar/AuthAvatar';

@Component({
    components: {
        avatar: Avatar,
    },
})
export default class AuthHome extends Vue {
    metadata: UserMetadata = null;
    originalEmail: string = null;
    originalName: string = null;
    originalPhone: string = null;
    originalAvatarUrl: string = null;
    originalAvatarPortraitUrl: string = null;

    updating: boolean = false;
    updated: boolean = false;

    private _sub: Subscription;

    created() {
        this.metadata = null;
        this.updating = false;
        this.updated = false;

        this._updateMetadata = this._updateMetadata.bind(this);
        this._updateMetadata = debounce(this._updateMetadata, 500);
    }

    mounted() {
        this._sub = authManager.loginState.subscribe((state) => {
            this.originalEmail = authManager.email;
            this.originalName = authManager.name;
            this.originalAvatarUrl = authManager.avatarUrl;
            this.originalAvatarPortraitUrl = authManager.avatarPortraitUrl;
            this.originalPhone = authManager.phone;
            this.metadata = {
                email: authManager.email,
                avatarUrl: authManager.avatarUrl,
                avatarPortraitUrl: authManager.avatarPortraitUrl,
                name: authManager.name,
                phone: authManager.phone,
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

    @Watch('metadata.name')
    updateName() {
        if (this.originalName === this.metadata.name) {
            return;
        }
        this.updating = true;
        this.updated = false;
        this._updateMetadata();
    }

    updateAvatar(avatar: { url: string; render: string }) {
        this.metadata.avatarUrl = avatar.url;
        this.metadata.avatarPortraitUrl = avatar.render;
        if (
            this.originalAvatarUrl === this.metadata.avatarUrl &&
            this.originalAvatarPortraitUrl === this.metadata.avatarPortraitUrl
        ) {
            return;
        }
        this.updating = true;
        this.updated = false;
        this._updateMetadata();
    }

    private async _updateMetadata() {
        let newMetadata: Partial<AppMetadata> = {};
        let hasChange = false;
        if (this.originalName !== this.metadata.name) {
            newMetadata.name = this.metadata.name;
            hasChange = true;
        }

        if (this.originalAvatarUrl !== this.metadata.avatarUrl) {
            newMetadata.avatarUrl = this.metadata.avatarUrl;
            hasChange = true;
        }

        if (
            this.originalAvatarPortraitUrl !== this.metadata.avatarPortraitUrl
        ) {
            newMetadata.avatarPortraitUrl = this.metadata.avatarPortraitUrl;
            hasChange = true;
        }

        if (hasChange) {
            await authManager.updateMetadata(newMetadata);
        }

        this.updating = false;

        if (hasChange) {
            this.updated = true;
        }
    }
}
