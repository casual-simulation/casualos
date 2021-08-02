import Vue from 'vue';
import Component from 'vue-class-component';
import { EventBus, Loading } from '@casual-simulation/aux-components';
import { authManager } from '../AuthManager';
import { Subscription } from 'rxjs';
import { Prop } from 'vue-property-decorator';

const WOLF3D_IFRAME_URL = 'https://casualos.readyplayer.me';

@Component({
    components: {
        loading: Loading,
    },
})
export default class AuthAvatar extends Vue {

    @Prop() avatarUrl: string;

    iframeUrl: string = WOLF3D_IFRAME_URL;

    createAvatar: boolean = false;
    
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

    private _onMessage(event: MessageEvent) {
        if (event.origin !== this.iframeUrl) {
            return;
        }

        let avatarUrl = event.data;
        this.createAvatar = false;

        console.log('[AuthAvatar] Got Avatar!', avatarUrl);

        this.$emit("updateAvatar", avatarUrl);
    }
}
