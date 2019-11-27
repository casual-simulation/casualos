import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Provide, Watch } from 'vue-property-decorator';
import {
    Bot,
    Assignment,
    isFormula,
    isAssignment,
    merge,
} from '@casual-simulation/aux-common';
import assign from 'lodash/assign';
import { appManager } from '../../shared/AppManager';
import { EventBus } from '../../shared/EventBus';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';

@Component({})
export default class BotRow extends Vue {
    @Prop() bot: Bot;
    @Prop() tag: string;
    @Prop() readOnly: boolean;
    @Prop({ default: true })
    showFormulaWhenFocused: boolean;

    value: string = '';
    isFormula: boolean = false;

    private _focused: boolean = false;
    private _simulation: BrowserSimulation;

    getBotManager() {
        return this._simulation;
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

    valueChanged(bot: Bot, tag: string, value: string) {
        this.value = value;
        this.$emit('tagChanged', bot, tag, value);
        this.getBotManager().editBot(bot, tag, value);
    }

    focus() {
        this._focused = true;
        this._updateValue(true);
        this.$emit('focusChanged', true);
    }

    blur() {
        this._focused = false;
        this._updateValue();
        this._updateAssignment();

        this.$emit('focusChanged', false);
    }

    triggerNewTag() {
        EventBus.$emit('addTag', 'bottom');
    }

    created() {
        appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [];
        });
        this._updateValue();
    }

    private _updateValue(force?: boolean) {
        this.isFormula = isFormula(this.value);

        if (!this._focused || force) {
            this._updateVisibleValue();
        }
    }

    private _updateVisibleValue() {
        if (!this._focused || !this.showFormulaWhenFocused) {
            this.value = this.getBotManager().helper.calculateFormattedBotValue(
                this.bot,
                this.tag
            );
        } else {
            const val = this.bot.tags[this.tag];
            if (isAssignment(val)) {
                const assignment: Assignment = val;
                this.value = assignment.editing
                    ? assignment.formula
                    : assignment.value;
            } else if (typeof val === 'object') {
                this.value = JSON.stringify(val);
            } else {
                this.value = val;
            }
        }
    }

    private _updateAssignment() {
        const val = this.bot.tags[this.tag];
        if (isAssignment(val)) {
            const assignment: Assignment = val;
            if (assignment.editing) {
                this.getBotManager().helper.updateBot(this.bot, {
                    tags: {
                        [this.tag]: assign(assignment, {
                            editing: false,
                        }),
                    },
                });
            }
        }
    }
}
