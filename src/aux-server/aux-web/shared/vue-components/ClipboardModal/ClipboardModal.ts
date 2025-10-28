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
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import type { Simulation } from '@casual-simulation/aux-vm';
import {
    writeTextToClipboard,
    readTextFromClipboard,
} from '../../ClipboardHelpers';
import Hotkey from '../Hotkey/Hotkey';
import {
    ON_PASTE_ACTION_NAME,
    onPasteArg,
} from '@casual-simulation/aux-common';

@Component({
    components: {
        hotkey: Hotkey,
    },
})
export default class ClipboardModal extends Vue {
    open: boolean = false;
    text: string = '';

    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    created() {
        this._sub = new Subscription();
        this._simulationSubs = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._simulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._simulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    closeDialog() {
        this.open = false;
        this.text = '';
    }

    async doCopy() {
        await writeTextToClipboard(this.text);
        this.closeDialog();
    }

    async onPaste(e: KeyboardEvent) {
        if (e.target instanceof HTMLElement) {
            if (e.target.matches('input') || e.target.matches('textarea')) {
                return;
            }
        }

        const text = await readTextFromClipboard();
        if (text) {
            for (let [id, sim] of appManager.simulationManager.simulations) {
                sim.helper.action(ON_PASTE_ACTION_NAME, null, onPasteArg(text));
            }
        }
    }

    private _simulationAdded(sim: Simulation): void {
        let sub = new Subscription();
        this._sub.add(sub);

        sub.add(
            sim.localEvents.subscribe(async (e) => {
                if (e.type === 'set_clipboard') {
                    try {
                        await writeTextToClipboard(e.text);
                    } catch (ex) {
                        this.text = e.text;
                        this.open = true;
                    }
                }
            })
        );
    }

    private _simulationRemoved(sim: Simulation): void {
        const sub = this._simulationSubs.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulationSubs.delete(sim);
    }
}
