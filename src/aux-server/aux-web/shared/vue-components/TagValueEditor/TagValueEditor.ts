import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { File } from '@casual-simulation/aux-common';
import SimpleTagEditor from '../SimpleTagEditor/SimpleTagEditor';

@Component({
    components: {
        'monaco-editor': () => import('../MonacoTagEditor/MonacoTagEditor'),
        'simple-editor': SimpleTagEditor,
    },
})
export default class TagValueEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) file: File;
    @Prop({ default: false }) showDesktopEditor: boolean;

    constructor() {
        super();
    }
}
