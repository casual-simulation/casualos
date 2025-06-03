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
import {
    hasValue,
    asyncResult,
    asyncError,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import NoSleep from '@uriopass/nosleep.js';

@Component({})
export default class WakeLock extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _noSleep: NoSleep;

    private _currentSimulation: BrowserSimulation;
    private _taskId: number | string;

    showDialog: boolean = false;

    constructor() {
        super();
    }

    created() {
        this._noSleep = new NoSleep();
        this._sub = new Subscription();
        this._simulations = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
        if (this._simulations) {
            for (let [sim, sub] of this._simulations) {
                sub.unsubscribe();
            }
        }
        if (this._noSleep) {
            this._noSleep.disable();
            this._noSleep = null;
        }
    }

    onConfirm() {
        try {
            this._noSleep.enable();
            if (hasValue(this._taskId)) {
                this._currentSimulation.helper.transaction(
                    asyncResult(this._taskId, null)
                );
            }
        } catch (err) {
            if (this._currentSimulation) {
                this._currentSimulation.helper.transaction(
                    asyncError(this._taskId, err.toString())
                );
            }
        } finally {
            this._taskId = null;
            this._currentSimulation = null;
        }
    }

    onCancel() {
        if (hasValue(this._taskId) && this._currentSimulation) {
            this._currentSimulation.helper.transaction(
                asyncError(this._taskId, {
                    errorCode: 'user_denied',
                    errorMessage: 'The user denied the wake lock.',
                })
            );
            this._taskId = null;
            this._currentSimulation = null;
        }
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'configure_wake_lock') {
                    if (e.enabled) {
                        if (this._noSleep.isEnabled) {
                            sim.helper.transaction(asyncResult(e.taskId, null));
                        } else {
                            this._taskId = e.taskId;
                            this._currentSimulation = sim;
                            this.showDialog = true;
                        }
                    } else {
                        try {
                            this._noSleep.disable();
                            sim.helper.transaction(asyncResult(e.taskId, null));
                        } catch (err) {
                            sim.helper.transaction(
                                asyncError(e.taskId, err.toString())
                            );
                        }
                    }
                } else if (e.type === 'get_wake_lock_configuration') {
                    sim.helper.transaction(
                        asyncResult(e.taskId, {
                            enabled: this._noSleep.isEnabled,
                        })
                    );
                }
            })
        );
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
    }
}
