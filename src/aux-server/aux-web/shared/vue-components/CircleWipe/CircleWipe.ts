import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    ON_PASTE_ACTION_NAME,
    onPasteArg,
    AsyncAction,
    enqueueAsyncResult,
    BotAction,
    enqueueAsyncError,
    hasValue,
} from '@casual-simulation/aux-common';

const CIRCLE_WIPE_ANIMATION_TIME_MS: number = 2000;

@Component({
    components: {},
})
export default class CircleWipe extends Vue {
    open: boolean = true;
    color: string = 'black';

    private _pendingTasks: [Simulation, AsyncAction][] = [];
    private _complete: boolean;
    private _timeout: any;
    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    created() {
        this.open = true;
        this.color = 'black';
        this._sub = new Subscription();
        this._simulationSubs = new Map();
        this._complete = true;
        this._pendingTasks = [];

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
            sim.localEvents.subscribe(async (e) => {
                if (e.type === 'show_circle_wipe') {
                    if (this.open !== e.open) {
                        this._cancelPendingTasks();
                        this._complete = false;
                        this._timeout = setTimeout(() => {
                            this._completePendingTasks();
                        }, CIRCLE_WIPE_ANIMATION_TIME_MS);
                        this.color = e.options.color;
                        this.open = e.open;
                    }
                    this._addTask([sim, e]);
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

    private _completePendingTasks() {
        this._complete = true;
        for (let [sim, task] of this._pendingTasks) {
            const actions: BotAction[] = [];
            enqueueAsyncResult(actions, task, undefined);
            if (actions.length > 0) {
                sim.helper.transaction(...actions);
            }
        }
        this._pendingTasks = [];
    }

    private _cancelPendingTasks() {
        if (hasValue(this._timeout)) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
        for (let [sim, task] of this._pendingTasks) {
            const actions: BotAction[] = [];
            enqueueAsyncError(
                actions,
                task,
                'Transition was overridden by another action.'
            );
            if (actions.length > 0) {
                sim.helper.transaction(...actions);
            }
        }
        this._pendingTasks = [];
    }

    private _addTask(task: [Simulation, AsyncAction]) {
        if (this._complete) {
            this._completeTask(task);
        } else {
            this._pendingTasks.push(task);
        }
    }

    private _completeTask(task: [Simulation, AsyncAction]) {
        const actions: BotAction[] = [];
        enqueueAsyncResult(actions, task[1], undefined);

        if (actions.length > 0) {
            task[0].helper.transaction(...actions);
        }
    }
}
