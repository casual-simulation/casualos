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
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import QrcodeStream from 'vue-qrcode-reader/src/components/QrcodeStream';

@Component({
    components: {
        'qrcode-stream': QrcodeStream,
    },
})
export default class AuthorizeAccountPopup extends Vue {
    @Prop({ required: true }) show: boolean;
    code: string = '';

    private _sim: BrowserSimulation;

    @Watch('show')
    visibleChanged() {
        this._sim = appManager.simulationManager.primary;
    }

    close() {
        this.$emit('close');
    }

    async cancel() {
        this.close();
    }

    onQRCodeScanned(code: string) {
        this._grant(code);
    }

    continueWithCode() {
        this._grant(this.code);
    }

    private _grant(token: string) {
        // return this._sim.login.setGrant(token);
    }
}
