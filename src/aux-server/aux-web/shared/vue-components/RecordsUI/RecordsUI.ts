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
import type {
    AuthHelperInterface,
    Simulation,
} from '@casual-simulation/aux-vm';
import { PrivoSignUpInfo } from '@casual-simulation/aux-vm';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { AuthHelper } from '@casual-simulation/aux-vm-browser';
import type { PublicRecordKeyPolicy } from '@casual-simulation/aux-common';
import {
    asyncResult,
    asyncError,
    approveAction,
    APPROVED_SYMBOL,
    hasValue,
    cleanPhoneNumber,
    mightBeEmailAddress,
} from '@casual-simulation/aux-common';
import type {
    RecordDataAction,
    DataRecordAction,
    GetRecordDataAction,
    EraseRecordDataAction,
    GrantInstAdminPermissionAction,
} from '@casual-simulation/aux-runtime';
import type { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';
import { parseRecordKey } from '@casual-simulation/aux-common';

@Component({
    components: {},
})
export default class RecordsUI extends Vue {
    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    showRequestPublicRecord: boolean = false;
    requestRecordName: string = '';
    requestRecordPolicy: PublicRecordKeyPolicy = null;

    showAllowRecordData: boolean = false;
    allowRecordName: string = '';
    allowAddress: string = '';
    completedAllowRecord: boolean = false;
    recordDataEvent: DataRecordAction = null;

    processing: boolean = false;

    showGrantInstAdminPermission: boolean = false;
    completedGrantInstAdminPermission: boolean = false;
    grantInstId: string = '';
    grantRecordsOrigin: string = '';

    private _requestRecordTaskId: number | string;
    private _requestRecordSimulation: BrowserSimulation;
    private _allowRecordSimulation: BrowserSimulation;
    private _currentLoginAuth: AuthHelperInterface;

    grantInstPermissionEvent: GrantInstAdminPermissionAction;
    private _grantInstPermisisonSimulation: BrowserSimulation;

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

    private _simulationAdded(sim: BrowserSimulation): void {
        let sub = new Subscription();
        this._sub.add(sub);

        sub.add(
            sim.localEvents.subscribe(async (e) => {
                if (e.type === 'get_public_record_key') {
                    this.showRequestPublicRecord = true;
                    this.requestRecordName = e.recordName;
                    this.requestRecordPolicy = e.policy;
                    this._requestRecordTaskId = e.taskId;
                    this._requestRecordSimulation = sim;
                    this.$emit('visible');
                } else if (e.type === 'record_data' && e.requiresApproval) {
                    this._allowRecordSimulation = sim;
                    this.showAllowRecordData = true;
                    this.completedAllowRecord = false;
                    this.recordDataEvent = e;
                    this.allowAddress = e.address;
                    let key = parseRecordKey(e.recordKey);
                    if (key) {
                        this.allowRecordName = key[0];
                    } else {
                        this.allowRecordName = 'N/A';
                    }
                } else if (e.type === 'get_record_data' && e.requiresApproval) {
                    this._allowRecordSimulation = sim;
                    this.showAllowRecordData = true;
                    this.completedAllowRecord = false;
                    this.recordDataEvent = e;
                    this.allowAddress = e.address;
                    this.allowRecordName = e.recordName;
                } else if (
                    e.type === 'erase_record_data' &&
                    e.requiresApproval
                ) {
                    this._allowRecordSimulation = sim;
                    this.showAllowRecordData = true;
                    this.completedAllowRecord = false;
                    this.recordDataEvent = e;
                    this.allowAddress = e.address;
                    let key = parseRecordKey(e.recordKey);
                    if (key) {
                        this.allowRecordName = key[0];
                    } else {
                        this.allowRecordName = 'N/A';
                    }
                } else if (e.type === 'grant_inst_admin_permission') {
                    this._grantInstPermisisonSimulation = sim;
                    this.showGrantInstAdminPermission = true;
                    this.completedGrantInstAdminPermission = false;
                    this.grantInstPermissionEvent = e;
                    this.allowRecordName = e.recordName;
                    this.grantInstId = sim.inst;
                    this.grantRecordsOrigin =
                        await sim.auth.primary.getRecordsOrigin();
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

    allowRecordData() {
        this.completedAllowRecord = true;
        const newEvent = approveAction(this.recordDataEvent);
        this._allowRecordSimulation.records.handleEvents([
            newEvent as
                | RecordDataAction
                | GetRecordDataAction
                | EraseRecordDataAction,
        ]);
        this.cancelAllowRecordData();
    }

    cancelAllowRecordData() {
        this.showAllowRecordData = false;
        if (
            this.recordDataEvent &&
            hasValue(this.recordDataEvent.taskId) &&
            !this.completedAllowRecord
        ) {
            this._allowRecordSimulation.helper.transaction(
                asyncResult(this.recordDataEvent.taskId, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'The user denied this operation.',
                })
            );
        }
        this.recordDataEvent = null;
        this.allowAddress = '';
        this.allowRecordName = '';
        this.completedAllowRecord = false;
    }

    grantInstPermission() {
        this.completedGrantInstAdminPermission = true;
        const newEvent = approveAction(this.grantInstPermissionEvent);
        this._grantInstPermisisonSimulation.records.handleEvents([newEvent]);
        this.cancelGrantInstPermission();
    }

    cancelGrantInstPermission() {
        this.showGrantInstAdminPermission = false;
        if (
            this.grantInstPermissionEvent &&
            hasValue(this.grantInstPermissionEvent.taskId) &&
            !this.completedGrantInstAdminPermission
        ) {
            this._grantInstPermisisonSimulation.helper.transaction(
                asyncResult(this.grantInstPermissionEvent.taskId, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'The user denied this operation.',
                })
            );
        }
        this.grantInstPermissionEvent = null;
        this.allowRecordName = '';
        this.completedGrantInstAdminPermission = false;
    }

    async createRecordKey(recordName: string) {
        const taskId = this._requestRecordTaskId;
        const sim = this._requestRecordSimulation;
        this._hideCreateRecordKey();

        if (taskId && sim) {
            try {
                const result = await sim.auth.primary.createPublicRecordKey(
                    recordName,
                    this.requestRecordPolicy
                );
                sim.helper.transaction(asyncResult(taskId, result));
            } catch (err) {
                sim.helper.transaction(asyncError(taskId, err));
            }
        }
    }

    async cancelCreateRecordKey() {
        const taskId = this._requestRecordTaskId;
        const sim = this._requestRecordSimulation;
        this._hideCreateRecordKey();

        if (taskId && sim) {
            const result: CreatePublicRecordKeyResult = {
                success: false,
                errorCode: 'unauthorized_to_create_record_key',
                errorMessage: 'The user denied the request.',
                errorReason: 'user_denied',
            };
            sim.helper.transaction(asyncResult(taskId, result));
        }
    }

    private _hideCreateRecordKey() {
        this.showRequestPublicRecord = false;
        this.requestRecordName = '';
        this._requestRecordTaskId = null;
        this._requestRecordSimulation = null;
        this.$emit('hidden');
    }
}
