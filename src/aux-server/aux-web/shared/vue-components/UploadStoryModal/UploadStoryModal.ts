import Vue from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import vueBotPond from 'vue-filepond';
import 'filepond/dist/filepond.min.css';

const BotPond = vueBotPond();

@Component({
    components: {
        'bot-pond': BotPond,
    },
})
export default class UploadStoryModal extends Vue {
    isOpen: boolean = false;

    /**
     * The bots that have been uploaded by the user.
     */
    uploadedFiles: File[] = [];

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

    private _simulationAdded(sim: Simulation): void {
        let sub = new Subscription();
        this._sub.add(sub);

        sub.add(
            sim.localEvents.subscribe(e => {
                if (e.type === 'show_upload_aux_file') {
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

    cancelFileUpload() {
        this.isOpen = false;
        this.uploadedFiles = [];
    }

    async uploadFiles() {
        await Promise.all(
            this.uploadedFiles.map(f => appManager.uploadState(f))
        );
        this.isOpen = false;
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
