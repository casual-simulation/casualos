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
import type { AsyncAction, BotAction } from '@casual-simulation/aux-common';
import {
    enqueueAsyncResult,
    enqueueAsyncError,
    hasValue,
} from '@casual-simulation/aux-common';

@Component({
    components: {},
})
export default class CircleWipe extends Vue {
    open: boolean = true;
    color: string = 'black';
    duration: number = 1;

    private _pendingTasks: [Simulation, AsyncAction][] = [];
    private _complete: boolean;
    private _timeout: any;
    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    get transitionDuration() {
        return `${this.duration}s, 0.25s`;
    }

    created() {
        this.open = true;
        this.color = 'black';
        this.duration = 1;
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
                        }, e.options.duration * 1000);
                        this.color = e.options.color;
                        this.duration = e.options.duration;
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
