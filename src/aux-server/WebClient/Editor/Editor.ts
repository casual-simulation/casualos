import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Inject} from 'vue-property-decorator';
import {filter} from 'rxjs/operators';
import {Object} from 'aux-common/Files';
import FileTable from '../FileTable/FileTable';
import { appManager } from '../AppManager';

@Component({
    components: {
        'file-table': FileTable
    }
})
export default class Editor extends Vue {
    
    private _intervalId: any;

    focusedFile: Object = null;
    focusedTag: string = null;

    get fileManager() {
        return appManager.fileManager;
    }

    onTagFocusChanged(event: { file: Object, tag: string, focused: boolean }) {
        if (event.focused) {
            this.focusedFile = event.file;
            this.focusedTag = event.tag;
        }
    }

    async created() {
        this.fileManager.fileUpdated
            .pipe(filter(f => f.type === 'object'))
            .subscribe((file: Object) => {
                if (this.focusedFile !== null) {
                    if (file.id === this.focusedFile.id) {
                        this.focusedFile = file;
                    }
                }
            });

        this._intervalId = setInterval(async () => {
            let userFile = this.fileManager.userFile;
            if (userFile) {
                await this.fileManager.updateFile(userFile, {
                    tags: {
                        _editorOpenTime: Date.now()
                    }
                });
            }
        }, 2500);

        document.addEventListener('beforeunload', async () => {
            await this._signalEditorClosed();
        });
    }

    async destroyed() {
        clearInterval(this._intervalId);
        await this._signalEditorClosed();
    }

    private async _signalEditorClosed() {
        console.log('[Editor] Closing...');
        let userFile = this.fileManager.userFile;
        if (userFile) {
            await this.fileManager.updateFile(userFile, {
                tags: {
                    _editorOpenTime: 0
                }
            });
        }
        console.log('[Editor] Closed.');
    }
};