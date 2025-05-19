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
import {
    calculateMeetPortalAnchorPointOffset,
    DEFAULT_CUSTOM_PORTAL_ANCHOR_POINT,
} from '@casual-simulation/aux-common';
import {
    injectPort,
    loadScript,
    loadText,
    reload,
} from '@casual-simulation/aux-vm-browser';
import Vue from 'vue';
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

    @Prop({ default: null })
    error: string;

    @Prop({ default: {} })
    extraStyle: any;

    @Prop({})
    ports: {
        [id: string]: MessagePort;
    };

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
            if (this.error) {
                this._injectError();
            } else {
                this._injectScript();
            }
        }
    }

    @Watch('source')
    async onSourceChanged() {
        this._loaded = false;
        await reload(this._iframe);
    }

    private async _injectScript() {
        if (this.ports) {
            for (let key in this.ports) {
                let port = this.ports[key];
                if (port) {
                    await injectPort(this._iframe.contentWindow, key, port);
                }
            }
        }
        await loadScript(this._iframe.contentWindow, 'main', this.source);
    }

    private async _injectError() {
        await loadText(this._iframe.contentWindow, 'error', this.error, 'pre');
    }
}
