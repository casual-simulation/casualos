/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import type {
    JitsiMeetExternalAPIOptions,
    JitsiApi,
    JitsiVideoConferenceJoinedEvent,
    JitsiVideoConferenceLeftEvent,
    JistiRecordingLinkAvailableEvent,
} from './JitsiTypes';

declare let JitsiMeetExternalAPI: {
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
    private _conferenceLeftDebounceMap: Map<string, number>;

    api() {
        return this._jitsiApi;
    }

    mounted() {
        this._conferenceLeftDebounceMap = new Map();
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
        if (!JitsiMeetExternalAPI) {
            return;
        }
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

        this._jitsiApi.on(
            'videoConferenceJoined',
            (e: JitsiVideoConferenceJoinedEvent) => {
                this.$emit('videoConferenceJoined', e);
            }
        );

        console.log('[JitsiMeet] Embed');
        this._jitsiApi.on(
            'videoConferenceLeft',
            (e: JitsiVideoConferenceLeftEvent) => {
                // Check that it has been at least 100 milliseconds
                // since the last time that a videoConferenceLeft event has been
                // sent for this room name
                const lastCallTime =
                    this._conferenceLeftDebounceMap.get(e.roomName) ?? 0;
                if (Date.now() - lastCallTime > 100) {
                    this.$emit('videoConferenceLeft', e);
                }
                this._conferenceLeftDebounceMap.set(e.roomName, Date.now());
            }
        );

        this._jitsiApi.on(
            'recordingLinkAvailable',
            (e: JistiRecordingLinkAvailableEvent) => {
                this.$emit('recordingLinkAvailable', e);
            }
        );
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
