import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { EventBus } from '@casual-simulation/aux-components';
import { JitsiMeetExternalAPIOptions, JitsiApi, JitsiParticipant, JitsiVideoConferenceJoinedEvent, JitsiVideoConferenceLeftEvent } from './JitsiTypes';

declare var JitsiMeetExternalAPI: {
    new (domain: string, options: JitsiMeetExternalAPIOptions): JitsiApi;
};

@Component({})
export default class JitsiMeet extends Vue {
    /**
     * The domain used to build the conference URL.
     */
    @Prop({
        default: '8x8.vc',
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
    private _removedJitsi: boolean;

    api() {
        return this._jitsiApi;
    }

    mounted() {
        this._loadScript('https://8x8.vc/external_api.js', () => {
            if (!JitsiMeetExternalAPI) {
                throw new Error('Jitsi Meet API not loaded');
            }
            if (this._removedJitsi) {
                return;
            }
            this._embedJitsiWidget();
        });
    }

    beforeDestroy() {
        this._removeJitsiWidget();
    }

    @Watch('options')
    optionsChanged() {
        this._removeJitsiWidget();
        this._embedJitsiWidget();
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

        this._jitsiApi.on('readyToClose', () => {
            this.$emit('closed');
        });

        this._jitsiApi.on('videoConferenceJoined', (e: JitsiVideoConferenceJoinedEvent) => {
            this.$emit('videoConferenceJoined', e);
        });

        this._jitsiApi.on('videoConferenceLeft', (e: JitsiVideoConferenceLeftEvent) => {
            this.$emit('videoConferenceLeft', e);
        });
    }

    private _removeJitsiWidget() {
        if (this._jitsiApi) {
            this._jitsiApi.dispose();
        }
        this._removedJitsi = true;
    }

    private _loadScript(src: string, cb: () => any) {
        const scriptEl = document.createElement('script');
        scriptEl.src = src;
        scriptEl.async = true;
        document.querySelector('head').appendChild(scriptEl);
        scriptEl.addEventListener('load', cb);
    }
}
