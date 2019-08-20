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
        if (!isDiff(null, file) && file.id !== 'empty') {
            this._simulation.recent.addTagDiff(
                `mod-${file.id}_${tag}`,
                tag,
                value
            );
            this._simulation.helper.updateFile(file, {
                tags: {
                    [tag]: value,
                },
            });
        } else {
            const updated = merge(file, {
                tags: {
                    [tag]: value,
                },
                values: {
                    [tag]: value,
                },
            });
            this._simulation.recent.addFileDiff(updated, true);
        }
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
            return [];
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
    }

    resize() {
        if (this.$refs.editor) {
            (<MonacoEditor>this.$refs.editor).resize();
        }
    }

    _updateModel() {
        const uri = getModelUri(this.file, this.tag);
        let model = monaco.editor.getModel(uri);
        if (!model) {
            model = monaco.editor.createModel(
                getModelScript(this.file, this.tag),
                isFilterTag(this.tag) ? 'javascript' : 'plaintext',
                uri
            );
        }

        if (this.$refs.editor) {
            (<MonacoEditor>this.$refs.editor).setModel(model);
        }
    }

    private _updateValue() {
        if (this.isFocused()) {
            return;
        }

        if (this.tag && this.file) {
            this.tagValue = getModelScript(this.file, this.tag);
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

function getModelUri(file: File, tag: string) {
    return monaco.Uri.parse(encodeURI(`file:///${file.id}/${tag}.js`));
}

function getModelScript(file: File, tag: string) {
    let val = file.tags[tag];
    if (typeof val !== 'undefined' && val !== null) {
        return val.toString();
    } else {
        return val;
    }
}
