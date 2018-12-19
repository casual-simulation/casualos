import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide} from 'vue-property-decorator';
import {Object} from 'common';

import FileTable from '../FileTable/FileTable';
import TagEditor from '../TagEditor/TagEditor';

@Component({
    components: {
        'file-table': FileTable,
        'tag-editor': TagEditor
    }
})
export default class Editor extends Vue {
    
    focusedFile: Object = null;
    focusedTag: string = null;

    onTagFocusChanged(event: { file: Object, tag: string, focused: boolean }) {
        if (event.focused) {
            this.focusedFile = event.file;
            this.focusedTag = event.tag;
        }
    }
};