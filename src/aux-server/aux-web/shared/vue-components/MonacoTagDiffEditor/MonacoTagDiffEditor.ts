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
    KNOWN_TAG_PREFIXES,
} from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SubscriptionLike, Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import BotTag from '../BotTag/BotTag';
import MonacoDiffEditor from '../MonacoDiffEditor/MonacoDiffEditor';
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
        'monaco-diff-editor': MonacoDiffEditor,
    },
})
export default class MonacoTagDiffEditor extends Vue {
    @Prop({ required: true }) originalBot: Bot;
    @Prop({ required: true }) originalTag: string;
    @Prop({ required: true }) originalTagSpace: string;

    @Prop({ required: true }) modifiedBot: Bot;
    @Prop({ required: true }) modifiedTag: string;
    @Prop({ required: true }) modifiedTagSpace: string;

    @Prop({ default: true }) showResize: boolean;

    private _simulation: BrowserSimulation;
    private _sub: Subscription;
    private _originalModel: monaco.editor.ITextModel;
    private _modifiedModel: monaco.editor.ITextModel;

    scriptPrefixes: ScriptPrefix[];
    hasError: boolean = false;
    showingError: boolean = false;

    @Watch('originalBot')
    @Watch('originalTag')
    @Watch('originalTagSpace')
    @Watch('modifiedBot')
    @Watch('modifiedTag')
    @Watch('modifiedTagSpace')
    modelPropertyChanged() {
        this._updateModel();
    }

    get docsLink() {
        // if (this.isListenTag) {
        //     const tagLink = this.tag
        //         .replace(/[\.\(\)\@\[\]]/g, '')
        //         .toLowerCase();
        //     return `https://docs.casualos.com/docs/listen-tags#${encodeURIComponent(
        //         tagLink
        //     )}`;
        // } else {
        //     const tagLink = this.tag.replace(/\./g, '').toLowerCase();
        //     return `https://docs.casualos.com/docs/tags#${encodeURIComponent(
        //         tagLink
        //     )}`;
        // }

        return '';
    }

    get isListenTag() {
        // return this.tag && this.tag.startsWith('on');
        return false;
    }

    get isScript() {
        // if (this.bot && this.tag) {
        //     const currentValue = getTagValueForSpace(
        //         this.bot,
        //         this.tag,
        //         this.space
        //     );
        //     return isScript(currentValue);
        // }
        return false;
    }

    get isFormula() {
        // if (this.bot && this.tag) {
        //     const currentValue = getTagValueForSpace(
        //         this.bot,
        //         this.tag,
        //         this.space
        //     );
        //     return (typeof currentValue === 'object' && hasValue(currentValue)) || isFormula(currentValue);
        // }
        return false;
    }

    get isAnyPrefix(): boolean {
        // if (this.bot && this.tag) {
        //     const currentValue = getTagValueForSpace(
        //         this.bot,
        //         this.tag,
        //         this.space
        //     );
        //     return hasPortalScript(
        //         this.scriptPrefixes.map((p) => p.prefix),
        //         currentValue
        //     );
        // }
        return false;
    }

    get originalTagPrefix(): string {
        if (this.originalBot && this.originalTag) {
            const currentValue = getTagValueForSpace(
                this.originalBot,
                this.originalTag,
                this.originalTagSpace
            );
            if (typeof currentValue === 'object' && hasValue(currentValue)) {
                return DNA_TAG_PREFIX;
            }
            return getScriptPrefix(KNOWN_TAG_PREFIXES, currentValue);
        }
        return null;
    }

    get modifiedTagPrefix(): string {
        if (this.modifiedBot && this.modifiedTag) {
            const currentValue = getTagValueForSpace(
                this.modifiedBot,
                this.modifiedTag,
                this.modifiedTagSpace
            );
            if (typeof currentValue === 'object' && hasValue(currentValue)) {
                return DNA_TAG_PREFIX;
            }
            return getScriptPrefix(KNOWN_TAG_PREFIXES, currentValue);
        }
        return null;
    }

    get editor() {
        return (<MonacoDiffEditor>this.$refs?.editor).editor;
    }

    constructor() {
        super();
    }

    created() {
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

    onEditorMounted(editor: monaco.editor.IStandaloneDiffEditor) {
        this._sub.add(
            watchEditor(this._simulation, editor.getOriginalEditor())
        );
        this._sub.add(
            watchEditor(this._simulation, editor.getModifiedEditor())
        );
    }

    onModelChanged(event: monaco.editor.IModelChangedEvent) {
        this.$emit('modelChanged', event);
    }

    destroyed() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
        setActiveModel(null);
    }

    originalEditorFocused() {
        // setActiveModel(this._model);
        this.$emit('onOriginalFocused', true);
    }

    originalEditorBlured() {
        setActiveModel(null);
        this.$emit('onOriginalFocused', false);
    }

    modifiedEditorFocused() {
        // setActiveModel(this._model);
        this.$emit('onModifiedFocused', true);
    }

    modifiedEditorBlured() {
        setActiveModel(null);
        this.$emit('onModifiedFocused', false);
    }

    makeNormalTag() {
        // this._replacePrefix('');
    }

    makeDnaTag() {
        // this._replacePrefix(DNA_TAG_PREFIX);
    }

    makeScriptTag() {
        // this._replacePrefix('@');
    }

    makePrefixTag(prefix: ScriptPrefix) {
        // this._replacePrefix(prefix.prefix);
    }

    toggleShowError() {
        // this.showingError = !this.showingError;
        // this._updateModel();
    }

    private _replacePrefix(prefix: string) {
        // let currentValue = getTagValueForSpace(this.bot, this.tag, this.space);
        // if (typeof currentValue === 'object') {
        //     return;
        // }
        // if (!hasValue(currentValue)) {
        //     currentValue = '';
        // }
        // let final = null as string;
        // if (this.isFormula) {
        //     final = prefix + parseFormulaSafe(currentValue);
        // } else if (this.isScript) {
        //     final = prefix + parseScriptSafe(currentValue);
        // } else {
        //     const script = trimPortalScript(
        //         this.scriptPrefixes.map((p) => p.prefix),
        //         currentValue
        //     );
        //     final = prefix + script;
        // }
        // if (final !== null) {
        //     this._simulation.helper.updateBot(
        //         this.bot,
        //         getUpdateForTagAndSpace(this.tag, final, this.space)
        //     );
        // }
    }

    isPrefix(prefix: ScriptPrefix): boolean {
        // if (this.bot && this.tag) {
        //     const currentValue = getTagValueForSpace(
        //         this.bot,
        //         this.tag,
        //         this.space
        //     );
        //     return isPortalScript(prefix.prefix, currentValue);
        // }
        return false;
    }

    private _updateModel() {
        const oldOriginalModel = this._originalModel;
        const oldModifiedModel = this._modifiedModel;

        this._originalModel = loadModel(
            this._simulation,
            this.originalBot,
            this.originalTag,
            this.originalTagSpace,
            () => (<MonacoDiffEditor>this.$refs?.editor).editor
        );

        this._modifiedModel = loadModel(
            this._simulation,
            this.modifiedBot,
            this.modifiedTag,
            this.modifiedTagSpace,
            () => (<MonacoDiffEditor>this.$refs?.editor).editor
        );

        if (
            oldOriginalModel &&
            oldOriginalModel !== this._originalModel &&
            oldOriginalModel !== this._modifiedModel &&
            !shouldKeepModelLoaded(oldOriginalModel)
        ) {
            unloadModel(oldOriginalModel);
        }

        if (
            oldModifiedModel &&
            oldModifiedModel !== this._originalModel &&
            oldModifiedModel !== this._modifiedModel &&
            !shouldKeepModelLoaded(oldModifiedModel)
        ) {
            unloadModel(oldModifiedModel);
        }

        if (this.$refs.editor) {
            (<MonacoDiffEditor>this.$refs.editor).setModel(
                this._originalModel,
                this._modifiedModel
            );
        }
    }
}
