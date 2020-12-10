import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { Bot } from '@casual-simulation/aux-common';
import SimpleTagEditor from '../SimpleTagEditor/SimpleTagEditor';
import MonacoLoader from '../MonacoLoader/MonacoLoader';
import MonacoLoaderError from '../MonacoLoaderError/MonacoLoaderError';

const MonacoAsync = () => ({
    component: import(
        /* webpackChunkName: "monaco-tag-editor" */ '../MonacoTagEditor/MonacoTagEditor'
    ).catch((err) => {
        console.error('Unable to load Monaco editor:', err);
        throw err;
    }),
    loading: MonacoLoader,
    error: MonacoLoaderError,

    delay: 50,
    timeout: 1000 * 60 * 5, // 5 minutes
});

@Component({
    components: {
        'monaco-editor': <any>MonacoAsync,
        'simple-editor': SimpleTagEditor,
    },
})
export default class TagValueEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) bot: Bot;
    @Prop({ required: true }) space: string;
    @Prop({ default: false }) showDesktopEditor: boolean;
    @Prop({ default: true }) showResize: boolean;

    constructor() {
        super();
    }
}
