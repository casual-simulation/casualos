import Vue from 'vue';
import Component from 'vue-class-component';
import { EventEmitter } from 'events';
import { Prop } from 'vue-property-decorator';

declare var JitsiMeetExternalAPI: {
    new (domain: string, options: JitsiMeetExternalAPIOptions): JitsiApi;
};

@Component({})
export default class JitsiMeet extends Vue {
    /**
     * The domain used to build the conference URL.
     */
    @Prop({
        default: 'meet.jit.si',
    })
    domain: string;

    /**
     * The options that should be used to join Jitsi.
     */
    @Prop({
        default: {},
    })
    options: JitsiMeetExternalAPIOptions;

    private _jitsiApi: JitsiApi;

    mounted() {
        this._loadScript('https://meet.jit.si/external_api.js', () => {
            if (!JitsiMeetExternalAPI)
                throw new Error('Jitsi Meet API not loaded');
            this._embedJitsiWidget();
        });
    }

    beforeDestroy() {
        this._removeJitsiWidget();
    }

    executeCommand(command: string, ...value: any[]) {
        this._jitsiApi.executeCommand(command, ...value);
    }

    private _embedJitsiWidget() {
        const options = {
            ...this.options,
            parentNode: this.$refs.jitsiContainer as Element,
        };
        this._jitsiApi = new JitsiMeetExternalAPI(
            this.domain,
            options
        ) as JitsiApi;
    }

    private _removeJitsiWidget() {
        if (this._jitsiApi) this._jitsiApi.dispose();
    }

    private _loadScript(src: string, cb: () => any) {
        const scriptEl = document.createElement('script');
        scriptEl.src = src;
        scriptEl.async = true;
        document.querySelector('head').appendChild(scriptEl);
        scriptEl.addEventListener('load', cb);
    }
}

interface JitsiMeetExternalAPIOptions {
    roomName?: string;
    userInfo?: JitsiParticipant;
    invitees?: JitsiParticipant[];
    devices?: any;
    onload?: () => void;
    width?: number | string;
    height?: number | string;
    parentNode?: Element;
    configOverwrite?: any;
    interfaceConfigOverwrite?: any;
    noSSL?: boolean;
    jwt?: any;
}

interface JitsiParticipant {
    email: string;
    displayName: string;
}

interface JitsiApi extends EventEmitter {
    executeCommand(command: string, ...args: any): void;
    dispose(): void;
}
