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

    private _loaded: boolean;

    get iframeUrl(): string {
        const origin = this.vmOrigin || location.origin;
        const iframeUrl = new URL('/aux-vm-iframe.html', origin);
        return iframeUrl.href;
    }

    private get _iframe() {
        return this.$el as HTMLIFrameElement;
    }

    created() {
        this._loaded = false;
    }

    onLoad() {
        if (!this._loaded) {
            this._loaded = true;
            this._injectScript();
        }
    }

    @Watch('source')
    async onSourceChanged() {
        await reload(this._iframe);
    }

    private async _injectScript() {
        await loadScript(this._iframe.contentWindow, 'main', this.source);
    }
}
