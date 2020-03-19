import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    BotAction,
    ShoutAction,
    ON_FILE_UPLOAD_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import BotTable from '../BotTable/BotTable';
import { SubscriptionLike, Subscription } from 'rxjs';
import { Input } from '../../scene/Input';
import { readFileArrayBuffer, readFileText } from '../../DownloadHelpers';

@Component({
    components: {},
})
export default class UploadFiles extends Vue {
    showUploadFiles: boolean = false;

    private _counter: number = 0;
    private _subscriptions: SubscriptionLike[];

    created() {
        this._subscriptions = [];
        this._counter = 0;
    }

    mounted() {
        const dragEnterListener = (event: DragEvent) => this.onDragEnter(event);
        const dragLeaveListener = (event: DragEvent) => this.onDragLeave(event);
        const dragOverListener = (event: DragEvent) => this.onDragOver(event);
        const dropListener = (event: DragEvent) => this.onDrop(event);

        document.addEventListener('dragenter', dragEnterListener, false);
        document.addEventListener('dragleave', dragLeaveListener, false);
        document.addEventListener('dragover', dragOverListener, false);
        document.addEventListener('drop', dropListener, false);

        this._subscriptions.push(
            new Subscription(() => {
                document.removeEventListener('dragenter', dragEnterListener);
                document.removeEventListener('dragleave', dragLeaveListener);
                document.removeEventListener('dragover', dragOverListener);
                document.removeEventListener('drop', dropListener);
            })
        );
    }

    beforeDestroy() {
        for (let sub of this._subscriptions) {
            sub.unsubscribe();
        }
    }

    onDragEnter(event: DragEvent) {
        if (this._counter < 0) {
            this._counter = 0;
        }
        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el
            )
        ) {
            if (event.dataTransfer.types.indexOf('Files') >= 0) {
                this.showUploadFiles = true;
                event.dataTransfer.dropEffect = 'copy';
                event.preventDefault();
                this._counter += 1;
            }
        }
    }

    onDragOver(event: DragEvent) {
        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el
            )
        ) {
            if (event.dataTransfer.types.indexOf('Files') >= 0) {
                this.showUploadFiles = true;
                event.dataTransfer.dropEffect = 'copy';
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }

    onDragLeave(event: DragEvent) {
        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el
            )
        ) {
            this._counter -= 1;
        }

        if (this._counter <= 0) {
            this.showUploadFiles = false;
        }
    }

    async onDrop(event: DragEvent) {
        this.showUploadFiles = false;
        this._counter = 0;

        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el
            )
        ) {
            event.preventDefault();

            let files: File[] = [];
            if (event.dataTransfer.items) {
                for (let i = 0; i < event.dataTransfer.items.length; i++) {
                    const item = event.dataTransfer.items[i];
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        files.push(file);
                    }
                }
            } else {
                for (let i = 0; i < event.dataTransfer.files.length; i++) {
                    const file = event.dataTransfer.files.item(i);
                    files.push(file);
                }
            }

            if (files.length > 0) {
                const finalFiles = await Promise.all(
                    files.map(async f => {
                        const data = await getFileData(f);
                        return {
                            name: f.name,
                            size: f.size,
                            data: data,
                        };
                    })
                );

                for (let sim of appManager.simulationManager.simulations.values()) {
                    let actions: ShoutAction[] = sim.helper.actions(
                        finalFiles.map(f => ({
                            bots: null,
                            eventName: ON_FILE_UPLOAD_ACTION_NAME,
                            arg: {
                                file: f,
                            },
                        }))
                    );

                    sim.helper.transaction(...actions);
                }
            }
        }
    }
}

const textFileExtensions = new Set([
    '.aux',
    '.json',
    '.txt',
    '.md',
    '.html',
    '.js',
    '.ts',
]);

async function getFileData(file: File): Promise<string | ArrayBuffer | object> {
    try {
        let textData: string = null;
        for (let textExt of textFileExtensions) {
            if (file.name.endsWith(textExt)) {
                textData = await readFileText(file);
                break;
            }
        }

        if (textData !== null) {
            return textData;
        }
    } catch {
        return await readFileArrayBuffer(file);
    }

    return await readFileArrayBuffer(file);
}
