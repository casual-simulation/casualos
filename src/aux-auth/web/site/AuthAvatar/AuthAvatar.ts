import Vue from 'vue';
import Component from 'vue-class-component';
import { EventBus, Loading } from '@casual-simulation/aux-components';
import { authManager } from '../AuthManager';
import { Subscription } from 'rxjs';
import { Prop } from 'vue-property-decorator';
import axios from 'axios';

const WOLF3D_IFRAME_URL = 'https://casualos.readyplayer.me';

@Component({
    components: {
        loading: Loading,
    },
})
export default class AuthAvatar extends Vue {
    @Prop() avatarUrl: string;
    @Prop({ default: null }) render: string;

    iframeUrl: string = WOLF3D_IFRAME_URL;

    /**
     * Wether we are in the process of creating or changing the avatar.
     */
    createAvatar: boolean = false;

    /**
     * Whether we have received an avatar from Wofl3D.
     */
    createdAvatar: boolean = false;

    get hasAvatar(): boolean {
        return !!this.avatarUrl;
    }

    private _sub: Subscription;

    created() {
        this.createAvatar = false;
        this.iframeUrl = WOLF3D_IFRAME_URL;
        this._onMessage = this._onMessage.bind(this);
    }

    mounted() {
        this._sub = new Subscription();

        window.addEventListener('message', this._onMessage, false);

        this._sub.add(() => {
            window.removeEventListener('message', this._onMessage);
        });
    }

    changeAvatar() {
        this.createAvatar = true;
        this.createdAvatar = false;
    }

    private async _onMessage(event: MessageEvent) {
        if (event.origin !== this.iframeUrl) {
            return;
        }

        let avatarUrl = event.data;

        this.createdAvatar = true;
        console.log('[AuthAvatar] Got Avatar!', avatarUrl);

        let portraitUrl: string = null;
        console.log('[AuthAvatar] Getting portrait URL...');

        try {
            const response = await axios.post(
                'https://render.readyplayer.me/render',
                {
                    model: avatarUrl,
                    scene: 'fullbody-portrait-v1',
                }
            );

            if (
                response.data &&
                response.data.renders &&
                response.data.renders.length > 0
            ) {
                portraitUrl = response.data.renders[0];
                console.log('[AuthAvatar] Got portrait!', portraitUrl);
            }
        } catch (e) {
            console.warn('[AuthAvatar] Failed to get portrait', e);
        }

        this.createdAvatar = false;

        this.$emit('updateAvatar', {
            url: avatarUrl,
            render: portraitUrl,
        });
    }
}
