import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import {
    Bot,
    isScript,
    isFormula,
    ScriptError,
    PrecalculatedBot,
    loadBots,
    hasValue,
    getTagValueForSpace,
    getUpdateForTagAndSpace,
    DNA_TAG_PREFIX,
    parseScriptSafe,
    parseFormulaSafe,
} from '@casual-simulation/aux-common';
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
    toSubscription,
    watchEditor,
} from '../../MonacoHelpers';
import * as monaco from '../../MonacoLibs';
import { filter, tap } from 'rxjs/operators';
import groupBy from 'lodash/groupBy';
import sumBy from 'lodash/sumBy';
import { tagValueHash } from '@casual-simulation/aux-common/aux-format-2';

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
    @Prop({ required: true }) space: string;
    @Prop({ default: true }) showResize: boolean;

    private _simulation: BrowserSimulation;
    private _sub: Subscription;
    private _model: monaco.editor.ITextModel;

    signed: boolean;

    @Watch('tag')
    tagChanged() {
        this._updateModel();
    }

    @Watch('bot')
    botChanged() {
        this._updateModel();
    }

    get docsLink() {
        if (this.isListenTag) {
            const tagLink = this.tag
                .replace(/[\.\(\)\@\[\]]/g, '')
                .toLowerCase();
            return `https://docs.casualsimulation.com/docs/listen-tags#${encodeURIComponent(
                tagLink
            )}`;
        } else {
            const tagLink = this.tag.replace(/\./g, '').toLowerCase();
            return `https://docs.casualsimulation.com/docs/tags#${encodeURIComponent(
                tagLink
            )}`;
        }
    }

    get isListenTag() {
        return this.tag && this.tag.startsWith('on');
    }

    get isScript() {
        if (this.bot && this.tag) {
            const currentValue = getTagValueForSpace(
                this.bot,
                this.tag,
                this.space
            );
            return isScript(currentValue);
        }
        return false;
    }

    get isFormula() {
        if (this.bot && this.tag) {
            const currentValue = getTagValueForSpace(
                this.bot,
                this.tag,
                this.space
            );
            return isFormula(currentValue);
        }
        return false;
    }

    get editor() {
        return (<MonacoEditor>this.$refs?.editor).editor;
    }

    constructor() {
        super();
    }

    created() {
        this.signed = false;

        this._sub = new Subscription();
        this._sub.add(
            appManager.whileLoggedIn((user, sim) => {
                this._simulation = sim;
                const sub = watchSimulation(sim, () => this.editor);

                this._sub.add(sub);
                return [sub];
            })
        );
    }

    mounted() {
        this._updateModel();
    }

    onEditorMounted(editor: monaco.editor.IStandaloneCodeEditor) {
        this._sub.add(watchEditor(this._simulation, editor));
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

    makeNormalTag() {
        let currentValue = getTagValueForSpace(this.bot, this.tag, this.space);
        if (typeof currentValue === 'object') {
            return;
        }
        if (!hasValue(currentValue)) {
            currentValue = '';
        }
        let final = null as string;
        if (this.isFormula) {
            final = parseFormulaSafe(currentValue);
        } else if (this.isScript) {
            final = parseScriptSafe(currentValue);
        }
        if (this.isScript || this.isFormula) {
            final = currentValue.slice(DNA_TAG_PREFIX.length);
        }
        if (final !== null) {
            this._simulation.helper.updateBot(
                this.bot,
                getUpdateForTagAndSpace(this.tag, final, this.space)
            );
        }
    }

    makeScriptTag() {
        let currentValue = getTagValueForSpace(this.bot, this.tag, this.space);
        if (typeof currentValue === 'object') {
            return;
        }
        if (!hasValue(currentValue)) {
            currentValue = '';
        }
        let final = null as string;
        if (this.isFormula) {
            final = '@' + parseFormulaSafe(currentValue);
        } else if (!this.isScript) {
            final = '@' + currentValue;
        }
        if (final !== null) {
            this._simulation.helper.updateBot(
                this.bot,
                getUpdateForTagAndSpace(this.tag, final, this.space)
            );
        }
    }

    private _updateModel() {
        const bot = this.bot;
        const tag = this.tag;
        const space = this.space;

        const oldModel = this._model;
        this._model = loadModel(
            this._simulation,
            bot,
            tag,
            space,
            () => (<MonacoEditor>this.$refs?.editor).editor
        );
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

        if (bot.signatures) {
            this.signed = !!bot.signatures[
                tagValueHash(bot.id, tag, bot.tags[tag])
            ];
        } else {
            this.signed = false;
        }
    }
}
