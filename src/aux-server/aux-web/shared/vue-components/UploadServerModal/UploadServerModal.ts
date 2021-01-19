import Vue from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import vueBotPond from 'vue-filepond';
import 'filepond/dist/filepond.min.css';
import { asyncError, asyncResult } from '@casual-simulation/aux-common';
import { getFileData } from '../../DownloadHelpers';

const BotPond = vueBotPond();

@Component({
    components: {
        'bot-pond': BotPond,
    },
})
export default class UploadServerModal extends Vue {
    isOpen: boolean = false;

    /**
     * The bots that have been uploaded by the user.
     */
    uploadedFiles: File[] = [];

    private _uploadAuxFile: boolean;
    private _sub: Subscription;
    private _currentSim: Simulation;
    private _simulationSubs: Map<Simulation, Subscription>;
    private _currentTask: number | string = null;

    created() {
        this._sub = new Subscription();
        this._simulationSubs = new Map();
        this._uploadAuxFile = false;
        this._currentSim = null;
        this._currentTask = null;

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
                if (e.type === 'show_upload_aux_file') {
                    this._uploadAuxFile = true;
                    this._currentSim = sim;
                    this._currentTask = null;
                    this.isOpen = true;
                } else if (e.type === 'show_upload_files') {
                    this._uploadAuxFile = false;
                    this._currentSim = sim;
                    this._currentTask = e.taskId;
                    this.isOpen = true;
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

    async cancelFileUpload() {
        if (this._uploadAuxFile) {
            this.isOpen = false;
            this.uploadedFiles = [];
        } else {
            try {
                await this._currentSim.helper.transaction(
                    asyncResult(this._currentTask, [], false)
                );
            } catch (err) {
                await this._currentSim.helper.transaction(
                    asyncError(this._currentTask, err.toString())
                );
            } finally {
                this.isOpen = false;
                this.uploadedFiles = [];
            }
        }
    }

    async uploadFiles() {
        if (this._uploadAuxFile) {
            await Promise.all(
                this.uploadedFiles.map((f) => appManager.uploadState(f))
            );
            this.isOpen = false;
        } else if (this._currentSim) {
            try {
                const files = await Promise.all(
                    this.uploadedFiles.map(async (f) => ({
                        name: f.name,
                        size: f.size,
                        data: await getFileData(f),
                    }))
                );
                await this._currentSim.helper.transaction(
                    asyncResult(this._currentTask, files, false)
                );
            } catch (err) {
                await this._currentSim.helper.transaction(
                    asyncError(this._currentTask, err.toString())
                );
            } finally {
                this.isOpen = false;
            }
        }
    }

    fileAdded(err: any, data: FilePondFile) {
        this.uploadedFiles.push(data.file);
    }

    fileRemoved(data: FilePondFile) {
        const index = this.uploadedFiles.indexOf(data.file);
        if (index >= 0) {
            this.uploadedFiles.splice(index, 1);
        }
    }
}
