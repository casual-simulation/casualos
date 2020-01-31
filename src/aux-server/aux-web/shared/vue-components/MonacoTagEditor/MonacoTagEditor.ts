import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { Bot, isScript, isFormula } from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SubscriptionLike, Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import BotTag from '../BotTag/BotTag';
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
        'bot-tag': BotTag,
        'monaco-editor': MonacoEditor,
    },
})
export default class MonacoTagEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) bot: Bot;

    private _simulation: BrowserSimulation;
    private _sub: Subscription;
    private _model: monaco.editor.ITextModel;

    @Watch('tag')
    tagChanged() {
        this._updateModel();
    }

    @Watch('bot')
    botChanged() {
        this._updateModel();
    }

    get isScript() {
        if (this.bot && this.tag) {
            return isScript(this.bot.tags[this.tag]);
        }
        return false;
    }

    get isFormula() {
        if (this.bot && this.tag) {
            return isFormula(this.bot.tags[this.tag]);
        }
        return false;
    }

    created() {
        this._sub = new Subscription();
        this._sub.add(
            appManager.whileLoggedIn((user, sim) => {
                this._simulation = sim;
                const sub = watchSimulation(sim);
                this._sub.add(sub);
                return [sub];
            })
        );
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
        const bot = this.bot;
        const tag = this.tag;

        const oldModel = this._model;
        this._model = loadModel(this._simulation, bot, tag);
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
