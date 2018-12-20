import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Inject} from 'vue-property-decorator';
import {filter} from 'rxjs/operators';
import {Object} from 'common';
import { FileManager } from '../FileManager';

import FileTable from '../FileTable/FileTable';
import TagEditor from '../TagEditor/TagEditor';

@Component({
    components: {
        'file-table': FileTable,
        'tag-editor': TagEditor
    },
    inject: {
        fileManager: 'fileManager'
    }
})
export default class Editor extends Vue {
    
    @Inject() private fileManager: FileManager;

    focusedFile: Object = null;
    focusedTag: string = null;

    onTagFocusChanged(event: { file: Object, tag: string, focused: boolean }) {
        if (event.focused) {
            this.focusedFile = event.file;
            this.focusedTag = event.tag;
        }
    }

    async created() {
        await this.fileManager.init();

        this.fileManager.fileUpdated
            .pipe(filter(f => f.type === 'object'))
            .subscribe((file: Object) => {
                if (this.focusedFile !== null) {
                    if (file.id === this.focusedFile.id) {
                        this.focusedFile = file;
                    }
                }
            });

        let userFile = this.fileManager.userFile;
        if (userFile) {
            await this.fileManager.updateFile(userFile, {
                tags: {
                    _editorCount: 1
                }
            });
        }
    }

    async destroyed() {
        let userFile = this.fileManager.userFile;
        if (userFile) {
            await this.fileManager.updateFile(userFile, {
                tags: {
                    _editorCount: 0
                }
            });
        }
    }
};