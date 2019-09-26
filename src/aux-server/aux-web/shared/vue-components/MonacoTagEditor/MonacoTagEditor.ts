import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { Bot } from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SubscriptionLike } from 'rxjs';
import { appManager } from '../../AppManager';
import FileTag from '../FileTag/FileTag';
import MonacoEditor from '../MonacoEditor/MonacoEditor';
import {
    setup,
    loadModel,
    shouldKeepModelLoaded,
    unloadModel,
    watchSimulation,
    setActiveModel,
} from '../../MonacoHelpers';
import * as monaco from '../../MonacoLibs';

setup();

@Component({
    components: {
        'file-tag': FileTag,
        'monaco-editor': MonacoEditor,
    },
})
export default class MonacoTagEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) file: Bot;

    private _simulation: BrowserSimulation;
    private _sub: SubscriptionLike;
    private _model: monaco.editor.ITextModel;

    @Watch('tag')
    tagChanged() {
        this._updateModel();
    }

    @Watch('file')
    fileChanged() {
        this._updateModel();
    }

    created() {
        this._sub = appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [watchSimulation(sim)];
        });
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

    editorFocused() {
        setActiveModel(this._model);
    }

    editorBlured() {
        setActiveModel(null);
    }

    private _updateModel() {
        const file = this.file;
        const tag = this.tag;

        const oldModel = this._model;
        this._model = loadModel(this._simulation, file, tag);
        if (
            oldModel &&
            oldModel !== this._model &&
            !shouldKeepModelLoaded(oldModel)
        ) {
            unloadModel(oldModel);
        }

        if (this.$refs.editor) {
            (<MonacoEditor>this.$refs.editor).setModel(this._model);
        }
    }
}
