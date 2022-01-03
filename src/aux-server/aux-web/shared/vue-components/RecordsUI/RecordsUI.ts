import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { asyncResult, asyncError } from '@casual-simulation/aux-common';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';

@Component({
    components: {},
})
export default class RecordsUI extends Vue {
    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    showRequestPublicRecord: boolean = false;
    requestRecordName: string = '';
    private _requestRecordTaskId: number | string;
    private _requestRecordSimulation: BrowserSimulation;

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
            sim.localEvents.subscribe((e) => {
                if (e.type === 'get_public_record_key') {
                    this.showRequestPublicRecord = true;
                    this.requestRecordName = e.recordName;
                    this._requestRecordTaskId = e.taskId;
                    this._requestRecordSimulation = sim;
                    this.$emit('visible');
                }
            })
        );
    }

    async createRecordKey(recordName: string) {
        const taskId = this._requestRecordTaskId;
        const sim = this._requestRecordSimulation;
        this._hideCreateRecordKey();

        if (taskId && sim) {
            const result = await sim.auth.createPublicRecordKey(recordName);
            if (result.success) {
                sim.helper.transaction(asyncResult(taskId, result));
            } else {
                sim.helper.transaction(asyncError(taskId, result));
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
            };
            sim.helper.transaction(asyncError(taskId, result));
        }
    }

    private _hideCreateRecordKey() {
        this.showRequestPublicRecord = false;
        this.requestRecordName = '';
        this._requestRecordTaskId = null;
        this._requestRecordSimulation = null;
        this.$emit('hidden');
    }

    private _simulationRemoved(sim: Simulation): void {
        const sub = this._simulationSubs.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulationSubs.delete(sim);
    }
}
