import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Provide, Watch } from 'vue-property-decorator';
import {
    File,
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
    @Prop() file: File;
    @Prop() tag: string;
    @Prop() readOnly: boolean;
    @Prop() updateTime: number;
    @Prop({ default: true })
    showFormulaWhenFocused: boolean;

    value: string = '';
    isFocused: boolean = false;
    isFormula: boolean = false;

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

    @Watch('updateTime')
    updateTimeChanged() {
        this._updateValue();
    }

    valueChanged(file: File, tag: string, value: string) {
        this.$emit('tagChanged', file, tag, value);
        if (!isDiff(null, file) && file.id !== 'empty') {
            this.getFileManager().recent.addTagDiff(
                `mod-${file.id}_${tag}`,
                tag,
                value
            );
            this.getFileManager().helper.updateFile(file, {
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
            this.getFileManager().recent.addFileDiff(updated, true);
        }
    }

    focus() {
        this.isFocused = true;
        this._updateValue(true);

        this.$emit('focusChanged', true);
    }

    blur() {
        this.isFocused = false;
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
        this.isFormula = isFormula(this.file.tags[this.tag]);

        if (!this.isFocused || force) {
            this._updateVisibleValue();
        }
    }

    // private _updateSimulationValue() {
    //     this._simulationValue = this.getFileManager().helper.calculateFormattedFileValue(
    //         this.file,
    //         this.tag
    //     );
    // }

    private _updateVisibleValue() {
        if (!this.isFocused || !this.showFormulaWhenFocused) {
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
