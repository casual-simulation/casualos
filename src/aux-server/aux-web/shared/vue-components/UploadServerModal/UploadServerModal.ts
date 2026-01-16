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
import Vue, { defineAsyncComponent } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../../AppManager';
import type { Simulation } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import 'filepond/dist/filepond.min.css';
import { asyncError, asyncResult } from '@casual-simulation/aux-common';
import { getFileData } from '../../DownloadHelpers';

const BotPondAsync = defineAsyncComponent({
    loader: () => import('vue-filepond').then((m) => m.default()),
    timeout: 1000 * 60 * 5, // 5 minutes
});

@Component({
    components: {
        'bot-pond': BotPondAsync,
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
            try {
                await Promise.all(
                    this.uploadedFiles.map((f) => appManager.uploadState(f))
                );
            } finally {
                this.isOpen = false;
                this.uploadedFiles = [];
            }
        } else if (this._currentSim) {
            try {
                const files = await Promise.all(
                    this.uploadedFiles.map(async (f) => ({
                        name: f.name,
                        size: f.size,
                        mimeType: f.type,
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
                this.uploadedFiles = [];
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
