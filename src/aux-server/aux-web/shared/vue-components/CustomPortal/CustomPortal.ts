import {
    calculateMeetPortalAnchorPointOffset,
    DEFAULT_CUSTOM_PORTAL_ANCHOR_POINT,
} from '@casual-simulation/aux-common';
import { loadScript, reload } from '@casual-simulation/aux-vm-browser';
import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class CustomPortal extends Vue {
    @Prop({ required: true })
    portalId: string;

    @Prop({ default: null })
    vmOrigin: string;

    @Prop({ default: '' })
    source: string;

    @Prop({ default: {} })
    extraStyle: any;

    defaultStyle: any;

    private _loaded: boolean;

    get iframeUrl(): string {
        const origin = this.vmOrigin || location.origin;
        const iframeUrl = new URL('/aux-vm-iframe.html', origin);
        return iframeUrl.href;
    }

    get iframeStyle() {
        return Object.assign({}, this.defaultStyle, this.extraStyle);
    }

    private get _iframe() {
        return this.$refs.iframe as HTMLIFrameElement;
    }

    created() {
        this._loaded = false;
        this.defaultStyle = calculateMeetPortalAnchorPointOffset(
            DEFAULT_CUSTOM_PORTAL_ANCHOR_POINT
        );
    }

    onLoad() {
        if (!this._loaded) {
            this._loaded = true;
            this._injectScript();
        }
    }

    @Watch('source')
    async onSourceChanged() {
        this._loaded = false;
        await reload(this._iframe);
    }

    private async _injectScript() {
        await loadScript(this._iframe.contentWindow, 'main', this.source);
    }
}
