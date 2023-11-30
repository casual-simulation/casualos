import {
    AppMetadata,
    UserMetadata,
} from '../../../../aux-backend/shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { Subscription } from 'rxjs';
import { debounce } from 'lodash';
import Avatar from '../AuthAvatar/AuthAvatar';
import Security from '../AuthSecurity/AuthSecurity';
import AuthSubscription from '../AuthSubscription/AuthSubscription';
import {
    isOpenAiKey,
    parseOpenAiKey,
} from '@casual-simulation/aux-records/AuthUtils';
import { PrivacyFeatures } from '@casual-simulation/aux-records';
import PrivacyItem from '../PrivacyItem/PrivacyItem';

@Component({
    components: {
        avatar: Avatar,
        security: Security,
        subscription: AuthSubscription,
        'privacy-item': PrivacyItem,
    },
})
export default class AuthHome extends Vue {
    metadata: UserMetadata = null;
    originalEmail: string = null;
    originalName: string = null;
    originalPhone: string = null;
    originalAvatarUrl: string = null;
    originalAvatarPortraitUrl: string = null;
    hasActiveSubscription: boolean = false;

    privacyFeatures: PrivacyFeatures = null;
    updating: boolean = false;
    updated: boolean = false;

    subscriptionsSupported: boolean = false;

    private _sub: Subscription;

    get showPrivacyFeatures() {
        return authManager.usePrivoLogin && !!this.privacyFeatures;
    }

    created() {
        this.metadata = null;
        this.updating = false;
        this.updated = false;
        this.privacyFeatures = null;
        this.subscriptionsSupported = authManager.subscriptionsSupported;

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
            this.subscriptionsSupported = authManager.subscriptionsSupported;
            this.hasActiveSubscription = authManager.hasActiveSubscription;
            this.privacyFeatures = {
                ...authManager.privacyFeatures,
            };

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
