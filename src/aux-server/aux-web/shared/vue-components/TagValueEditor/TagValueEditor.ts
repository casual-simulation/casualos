import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import MonacoEditor from '../MonacoEditor/MonacoEditor';
import {
    File,
    isFormula,
    isDiff,
    merge,
    isFilterTag,
} from '@casual-simulation/aux-common';
import FileTag from '../FileTag/FileTag';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { SubscriptionLike } from 'rxjs';
import * as monaco from 'monaco-editor';
import {
    getScript,
    loadModel,
    watchSimulation,
    setActiveModel,
} from '../../MonacoHelpers';

@Component({
    components: {
        'monaco-editor': MonacoEditor,
        'file-tag': FileTag,
    },
})
export default class TagValueEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) file: File;
    @Prop() setLargeSheet: boolean;
    @Prop({ default: false }) showDesktopEditor: boolean;

    tagValue: any = '';

    private _simulation: BrowserSimulation;
    private _sub: SubscriptionLike;

    get isTagFormula(): boolean {
        return isFormula(this.tagValue);
    }

    get isTagScript(): boolean {
        return isFilterTag(this.tag);
    }

    get language(): string {
        return this.isTagScript ? 'javascript' : 'plaintext';
    }

    constructor() {
        super();
    }

    @Watch('tagValue')
    valueChanged() {
        let file = this.file;
        let tag = this.tag;
        let value = this.tagValue;
        this._updateFile(file, tag, value);
    }

    private _updateFile(file: File, tag: string, value: any) {
        this._simulation.editFile(file, tag, value);
    }

    @Watch('tag')
    tagChanged() {
        this._updateValue();
        this._updateModel();
    }

    @Watch('file')
    fileChanged() {
        this._updateValue();
        this._updateModel();
    }

    @Watch('showDesktopEditor')
    showEditorChanged() {
        if (this.showDesktopEditor) {
            this.$nextTick(() => {
                this._updateModel();
            });
        }
    }

    created() {
        this._sub = appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [watchSimulation(sim)];
        });
        this._updateValue();
    }

    mounted() {
        this._updateModel();
    }

    destroyed() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
        setActiveModel(null);
    }

    resize() {
        if (this.$refs.editor) {
            (<MonacoEditor>this.$refs.editor).resize();
        }
    }

    _updateModel() {
        const file = this.file;
        const tag = this.tag;
        let model = loadModel(this._simulation, file, tag);
        setActiveModel(model);

        if (this.$refs.editor) {
            (<MonacoEditor>this.$refs.editor).setModel(model);
        }
    }

    private _updateValue() {
        if (this.isFocused()) {
            return;
        }

        if (this.tag && this.file) {
            this.tagValue = getScript(this.file, this.tag);
        } else {
            this.tagValue = '';
        }
    }

    isFocused() {
        if (this.$el && document.activeElement) {
            return this.$el.contains(document.activeElement);
        }
        return false;
    }
}
