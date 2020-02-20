import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
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
                .pipe(tap(sim => this._simulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._simulationRemoved(sim)))
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
        await this.$copyText(this.text);
        this.closeDialog();
    }

    async onPaste() {
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
            sim.localEvents.subscribe(async e => {
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
