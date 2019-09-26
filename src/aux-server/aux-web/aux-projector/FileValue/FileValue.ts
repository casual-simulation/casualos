import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Provide, Watch } from 'vue-property-decorator';
import {
    Bot,
    Assignment,
    isFormula,
    isAssignment,
    isDiff,
    merge,
} from '@casual-simulation/aux-common';
import { assign } from 'lodash';
import { appManager } from '../../shared/AppManager';
import { EventBus } from '../../shared/EventBus';
import uuid from 'uuid/v4';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';

@Component({})
export default class FileRow extends Vue {
    @Prop() file: Bot;
    @Prop() tag: string;
    @Prop() readOnly: boolean;
    @Prop({ default: true })
    showFormulaWhenFocused: boolean;

    value: string = '';
    isFormula: boolean = false;

    private _focused: boolean = false;
    private _simulation: BrowserSimulation;

    getFileManager() {
        return this._simulation;
    }

    constructor() {
        super();
    }

    @Watch('file')
    fileChanged() {
        this._updateValue();
    }

    @Watch('tag')
    tagChanged() {
        this._updateValue();
    }

    valueChanged(file: Bot, tag: string, value: string) {
        this.value = value;
        this.$emit('tagChanged', file, tag, value);
        this.getFileManager().editFile(file, tag, value);
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
            this.value = this.getFileManager().helper.calculateFormattedFileValue(
                this.file,
                this.tag
            );
        } else {
            const val = this.file.tags[this.tag];
            if (isAssignment(val)) {
                const assignment: Assignment = val;
                this.value = assignment.editing
                    ? assignment.formula
                    : assignment.value;
            } else {
                this.value = val;
            }
        }
    }

    private _updateAssignment() {
        const val = this.file.tags[this.tag];
        if (isAssignment(val)) {
            const assignment: Assignment = val;
            if (assignment.editing) {
                this.getFileManager().helper.updateFile(this.file, {
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
