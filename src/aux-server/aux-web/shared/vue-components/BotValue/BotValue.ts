import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Provide, Watch } from 'vue-property-decorator';
import {
    Bot,
    isFormula,
    merge,
    hasValue,
    isScript,
    getTagValueForSpace,
    getSpaceForTag,
    DNA_TAG_PREFIX,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { EventBus } from '@casual-simulation/aux-components';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';

@Component({})
export default class BotValue extends Vue {
    @Prop() simId: string;
    @Prop() bot: Bot;
    @Prop() tag: string;
    @Prop() readOnly: boolean;
    @Prop() space: string;

    @Prop({ default: false })
    alwaysShowRealValue: boolean;

    @Prop({ default: true })
    showFormulaWhenFocused: boolean;

    @Prop({ default: true })
    showSpace: boolean;

    value: string = '';
    isFormula: boolean = false;
    isScript: boolean = false;

    private _focused: boolean = false;
    private _selectionOffset: number = 0;
    private _selectionStart: number;
    private _selectionEnd: number;
    private _selectionDirection: HTMLTextAreaElement['selectionDirection'];

    get activeTheme() {
        return `md-theme-${(Vue as any).material.theming.theme || 'default'}`;
    }

    get spaceAbbreviation() {
        if (this.space) {
            return this.space.slice(0, 1);
        } else {
            return 'N/A';
        }
    }

    private _textarea() {
        return this.$refs.textarea as HTMLTextAreaElement;
    }

    getBotManager() {
        return appManager.simulationManager.simulations.get(this.simId);
    }

    constructor() {
        super();
    }

    @Watch('bot')
    botChanged() {
        this._updateValue();
    }

    @Watch('tag')
    tagChanged() {
        this._updateValue();
    }

    setInitialValue(value: string) {
        if (!hasValue(this.value)) {
            this.value = value;
            this.$emit(
                'tagChanged',
                this.simId,
                this.bot,
                this.tag,
                value,
                this.space
            );
            this.getBotManager().editBot(this.bot, this.tag, value, this.space);
        }
    }

    valueChanged(bot: Bot, tag: string, value: string) {
        const tagValue = getTagValueForSpace(this.bot, this.tag, this.space);
        if (typeof tagValue === 'object' && !isFormula(value)) {
            value = DNA_TAG_PREFIX + value;
            this._selectionOffset = DNA_TAG_PREFIX.length;
        }
        this._saveSelectionPoint();
        this.value = value;
        this.$nextTick(() => {
            this._restoreSelectionPoint();
        });
        this.$emit('tagChanged', this.simId, bot, tag, value, this.space);
        this.getBotManager().editBot(bot, tag, value, this.space);
    }

    focus() {
        if (this.$refs.textarea) {
            (<HTMLTextAreaElement>this.$refs.textarea).focus();
        }
    }

    onFocus() {
        this._focused = true;
        this._updateValue(true);
        this.$emit('focusChanged', true);
    }

    onBlur() {
        this._focused = false;
        this._updateValue();

        this.$emit('focusChanged', false);
    }

    triggerNewTag() {
        EventBus.$emit('addTag', 'bottom');
    }

    created() {
        this._updateValue();
    }

    private _updateValue(force?: boolean) {
        if (!this._focused || force) {
            this._updateVisibleValue();
        }
        this.isFormula = isFormula(this.value);
        this.isScript = isScript(this.value);
    }

    private _updateVisibleValue() {
        if (
            !this.alwaysShowRealValue &&
            (!this._focused || !this.showFormulaWhenFocused)
        ) {
            this.value = this.getBotManager().helper.calculateFormattedBotValue(
                this.bot,
                this.tag
            );
        } else {
            this._saveSelectionPoint();
            const val = getTagValueForSpace(this.bot, this.tag, this.space);
            if (typeof val === 'object') {
                this.value = JSON.stringify(val);
            } else {
                this.value = val;
            }

            this.$nextTick(() => {
                this._restoreSelectionPoint();
            });
        }
    }

    private _saveSelectionPoint() {
        let textarea = this._textarea();
        if (!textarea) {
            return;
        }
        this._selectionStart = textarea.selectionStart;
        this._selectionEnd = textarea.selectionEnd;
        this._selectionDirection = textarea.selectionDirection;
    }

    private _restoreSelectionPoint() {
        let textarea = this._textarea();
        if (
            !textarea ||
            !hasValue(this._selectionStart) ||
            !hasValue(this._selectionEnd) ||
            !hasValue(this._selectionDirection)
        ) {
            return;
        }

        textarea.setSelectionRange(
            this._selectionStart + this._selectionOffset,
            this._selectionEnd + this._selectionOffset,
            this._selectionDirection
        );
        this._selectionOffset = 0;
    }
}
