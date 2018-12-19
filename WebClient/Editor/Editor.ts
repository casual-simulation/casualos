import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide} from 'vue-property-decorator';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import FileTable from '../FileTable/FileTable';

@Component({
    components: {
        'file-table': FileTable
    }
})
export default class Editor extends Vue {
    code: string = 'console.log("Hello world!")';

    editor: monaco.editor.ICodeEditor;

    mounted() {
        this.editor = monaco.editor.create(<HTMLElement>this.$refs.editor, {
            value: 'console.log("Hello, world!")',
            language: 'javascript'
        });
    }
};