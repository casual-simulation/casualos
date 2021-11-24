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
    isPortalScript,
    hasPortalScript,
    getScriptPrefix,
    trimPortalScript,
    calculateBotValue,
    isBotLink,
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
import { filter, flatMap, tap } from 'rxjs/operators';
import { tagValueHash } from '@casual-simulation/aux-common/aux-format-2';
import { ScriptPrefix } from '@casual-simulation/aux-vm';

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
    scriptPrefixes: ScriptPrefix[];
    hasError: boolean = false;
    showingError: boolean = false;

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
            return `https://docs.casualos.com/docs/listen-tags#${encodeURIComponent(
                tagLink
            )}`;
        } else {
            const tagLink = this.tag.replace(/\./g, '').toLowerCase();
            return `https://docs.casualos.com/docs/tags#${encodeURIComponent(
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

    get isLink() {
        if (this.bot && this.tag) {
            const currentValue = getTagValueForSpace(
                this.bot,
                this.tag,
                this.space
            );
            return isBotLink(currentValue);
        }
        return false;
    }

    get isAnyPrefix() {
        if (this.bot && this.tag) {
            const currentValue = getTagValueForSpace(
                this.bot,
                this.tag,
                this.space
            );
            return hasPortalScript(
                this.scriptPrefixes.map((p) => p.prefix),
                currentValue
            );
        }
        return false;
    }

    get currentPrefix() {
        if (this.bot && this.tag) {
            const currentValue = getTagValueForSpace(
                this.bot,
                this.tag,
                this.space
            );
            return getScriptPrefix(
                this.scriptPrefixes.map((p) => p.prefix),
                currentValue
            );
        }
        return null;
    }

    get editor() {
        return (<MonacoEditor>this.$refs?.editor).editor;
    }

    constructor() {
        super();
    }

    created() {
        this.signed = false;
        this.hasError = false;
        this.showingError = false;

        this._sub = new Subscription();
        this._sub.add(
            appManager.whileLoggedIn((user, sim) => {
                this._simulation = sim;
                const sub = watchSimulation(sim, () => this.editor);

                sub.add(
                    sim.portals.prefixesDiscovered
                        .pipe(flatMap((a) => a))
                        .subscribe((portal) => {
                            this.scriptPrefixes =
                                sim.portals.scriptPrefixes.filter(
                                    (p) => !p.isDefault
                                );
                        })
                );

                sub.add(
                    sim.portals.prefixesRemoved
                        .pipe(flatMap((a) => a))
                        .subscribe((portal) => {
                            this.scriptPrefixes =
                                sim.portals.scriptPrefixes.filter(
                                    (p) => !p.isDefault
                                );
                        })
                );

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
        this.$emit('onFocused', true);
    }

    editorBlured() {
        setActiveModel(null);
        this.$emit('onFocused', false);
    }

    makeNormalTag() {
        this._replacePrefix('');
    }

    makeDnaTag() {
        this._replacePrefix(DNA_TAG_PREFIX);
    }

    makeScriptTag() {
        this._replacePrefix('@');
    }

    makePrefixTag(prefix: ScriptPrefix) {
        this._replacePrefix(prefix.prefix);
    }

    toggleShowError() {
        this.showingError = !this.showingError;
        this._updateModel();
    }

    private _replacePrefix(prefix: string) {
        let currentValue = getTagValueForSpace(this.bot, this.tag, this.space);
        if (typeof currentValue === 'object') {
            return;
        }
        if (!hasValue(currentValue)) {
            currentValue = '';
        }
        let final = null as string;
        if (this.isFormula) {
            final = prefix + parseFormulaSafe(currentValue);
        } else if (this.isScript) {
            final = prefix + parseScriptSafe(currentValue);
        } else {
            const script = trimPortalScript(
                this.scriptPrefixes.map((p) => p.prefix),
                currentValue
            );
            final = prefix + script;
        }
        if (final !== null) {
            this._simulation.helper.updateBot(
                this.bot,
                getUpdateForTagAndSpace(this.tag, final, this.space)
            );
        }
    }

    isPrefix(prefix: ScriptPrefix): boolean {
        if (this.bot && this.tag) {
            const currentValue = getTagValueForSpace(
                this.bot,
                this.tag,
                this.space
            );
            return isPortalScript(prefix.prefix, currentValue);
        }
        return false;
    }

    private _updateModel() {
        const bot = this.bot;
        const tag = this.tag;
        const space = this.space;

        const calculatedTagValue = calculateBotValue(null, bot, tag);
        const rawTagValue = getTagValueForSpace(bot, tag, space);

        this.hasError =
            typeof rawTagValue === 'string' &&
            typeof calculatedTagValue === 'string' &&
            rawTagValue !== calculatedTagValue;

        const oldModel = this._model;
        if (this.hasError && this.showingError) {
            const uri = monaco.Uri.parse(
                encodeURI(`file:///scriptError.error.txt`)
            );
            let model = monaco.editor.getModel(uri);
            if (model) {
                model.setValue(calculatedTagValue);
            } else {
                model = monaco.editor.createModel(
                    calculatedTagValue,
                    'plaintext',
                    uri
                );
            }
            this._model = model;
        } else {
            this._model = loadModel(
                this._simulation,
                bot,
                tag,
                space,
                () => (<MonacoEditor>this.$refs?.editor).editor
            );
        }
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
            this.signed =
                !!bot.signatures[tagValueHash(bot.id, tag, bot.tags[tag])];
        } else {
            this.signed = false;
        }
    }
}
