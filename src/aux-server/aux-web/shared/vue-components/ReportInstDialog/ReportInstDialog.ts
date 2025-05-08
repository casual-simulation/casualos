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
import type {
    ReportInstAction,
    FormError,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    asyncResult,
    asyncError,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import FieldErrors from '../FieldErrors/FieldErrors';
import { getPermalink } from '../../../aux-player/UrlUtils';
import type { ReportReason } from '@casual-simulation/aux-records';
import {
    REPORT_REASON_FIELD,
    REPORT_REASON_TEXT_FIELD,
    getFormErrors,
} from '@casual-simulation/aux-common';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class ReportInstDialog extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, string> = new Map();
    private _currentSimulation: BrowserSimulation;
    private _openEvent: ReportInstAction;

    showDialog: boolean = false;
    processing: boolean = false;
    reportReason: ReportReason = null;
    reportReasonText: string = null;
    privacyPolicyUrl: string = null;
    termsOfServiceUrl: string = null;

    errors: FormError[] = [];

    get reportReasonFieldClass() {
        return this.errors.some((e) => e.for === REPORT_REASON_FIELD)
            ? 'md-invalid'
            : '';
    }

    get reportReasonTextFieldClass() {
        return this.errors.some((e) => e.for === REPORT_REASON_TEXT_FIELD)
            ? 'md-invalid'
            : '';
    }

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this.showDialog = false;
        this.processing = false;
        this.privacyPolicyUrl = null;
        this.termsOfServiceUrl = null;

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
        appManager.auth.primary.getPolicyUrls().then((urls) => {
            this.privacyPolicyUrl = urls.privacyPolicyUrl;
            this.termsOfServiceUrl = urls.termsOfServiceUrl;
        });
    }

    beforeDestroy() {
        this.processing = false;
        this.showDialog = false;
        this._currentSimulation = null;
        this._openEvent = null;
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    onDialogClosed() {
        this.showDialog = false;

        if (
            this._openEvent &&
            this._currentSimulation &&
            hasValue(this._openEvent.taskId)
        ) {
            this._currentSimulation.helper.transaction(
                asyncResult(this._openEvent.taskId, null)
            );
        }
        this._openEvent = null;
        this._currentSimulation = null;
    }

    hideDialog() {
        this.processing = false;
        this.showDialog = false;
    }

    async submitReport() {
        this.errors = [];
        if (!this.reportReason) {
            this.errors.push({
                for: REPORT_REASON_FIELD,
                errorCode: 'invalid_report_reason',
                errorMessage: 'Please select a reason.',
            });
        }
        if (!this.reportReasonText) {
            this.errors.push({
                for: REPORT_REASON_TEXT_FIELD,
                errorCode: 'invalid_report_reason_text',
                errorMessage: 'Please provide a description.',
            });
        }

        if (this.errors.length > 0) {
            return;
        }

        try {
            this.processing = true;

            const result = await this._currentSimulation.records.reportInst({
                recordName: this._currentSimulation.recordName,
                inst: this._currentSimulation.inst,
                automaticReport: false,
                reportReason: this.reportReason,
                reportReasonText: this.reportReasonText,
                reportedPermalink: getPermalink(
                    location.href,
                    this._currentSimulation.recordName
                ),
                reportedUrl: location.href,
            });

            this.errors = getFormErrors(result);

            if (result.success) {
                this.hideDialog();
            }
        } catch (err) {
            if (hasValue(this._openEvent?.taskId) && this._currentSimulation) {
                this._currentSimulation.helper.transaction(
                    asyncError(
                        this._openEvent.taskId,
                        new Error('Unable to report inst.')
                    )
                );
            }
        } finally {
            this.processing = false;
        }
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            sim.localEvents.subscribe(async (e) => {
                if (e.type === 'report_inst') {
                    if (sim.origin.isStatic) {
                        if (hasValue(e.taskId)) {
                            sim.helper.transaction(
                                asyncError(
                                    e.taskId,
                                    new Error('Cannot report static insts')
                                )
                            );
                        }
                    } else {
                        this._currentSimulation = sim;
                        this._openEvent = e;
                        this.errors = [];
                        this.showDialog = true;
                        this.processing = false;
                    }
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
        this._portals.delete(sim);
    }

    /**
     * Sends the given event and argument to every loaded simulation.
     * @param eventName The event to send.
     * @param arg The argument to send.
     */
    private async _superAction(eventName: string, arg?: any) {
        for (let [, sim] of appManager.simulationManager.simulations) {
            await sim.helper.action(eventName, null, arg);
        }
    }
}
