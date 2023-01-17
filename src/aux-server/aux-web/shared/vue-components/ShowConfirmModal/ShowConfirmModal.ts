import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    ShowInputType,
    ShowInputSubtype,
    ShowInputOptions,
    BotCalculationContext,
    calculateFormattedBotValue,
    Bot,
    ShowInputForTagAction,
    ShowInputAction,
    asyncResult,
    ShowConfirmAction,
    ShowConfirmOptions,
    hasValue,
} from '@casual-simulation/aux-common';

@Component({})
export default class ShowConfirmModal extends Vue {
    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    title: string = '';
    content: string = '';
    confirmText: string = 'Confirm';
    cancelText: string = 'Cancel';

    showConfirmDialog: boolean = false;

    private _currentTask: number | string = null;
    private _confirmDialogSimulation: Simulation = null;

    created() {
        this.title = '';
        this.content = '';
        this.confirmText = 'Confirm';
        this.cancelText = 'Cancel';
        this.showConfirmDialog = false;
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

    private _simulationAdded(sim: Simulation): void {
        let sub = new Subscription();
        this._sub.add(sub);

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'show_confirm') {
                    this._showConfirm(sim, e);
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

    private _showConfirm(simulation: Simulation, event: ShowConfirmAction) {
        this._updateOptions(event.options);
        this._confirmDialogSimulation = simulation;
        this._currentTask = event.taskId;
        this.showConfirmDialog = true;
    }

    async onCancel() {
        if (this.showConfirmDialog) {
            this.showConfirmDialog = false;
        }

        this._sendResult(false);

        this._currentTask = null;
        this._confirmDialogSimulation = null;
    }

    async onConfirm() {
        if (this.showConfirmDialog) {
            this.showConfirmDialog = false;
        }

        this._sendResult(true);
        this._currentTask = null;
        this._confirmDialogSimulation = null;
    }

    private _sendResult(confirmed: boolean) {
        if (this._confirmDialogSimulation && hasValue(this._currentTask)) {
            this._confirmDialogSimulation.helper.transaction(
                asyncResult(this._currentTask, confirmed)
            );
        }
    }

    private _updateOptions(options: ShowConfirmOptions) {
        this.title = options.title;
        this.content = options.content;
        this.confirmText =
            typeof options.confirmText === 'string'
                ? options.confirmText
                : 'Confirm';
        this.cancelText =
            typeof options.cancelText === 'string'
                ? options.cancelText
                : 'Cancel';
    }
}
