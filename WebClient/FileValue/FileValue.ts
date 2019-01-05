import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { FileManager } from '../FileManager';
import { Assignment, isFormula, isAssignment } from 'common/FileCalculations';
import { SubscriptionLike } from 'rxjs';
import {Object, File} from 'common';
import {invertColor, colorConvert} from '../utils';
import {assign} from 'lodash';

const numLoadingSteps: number = 4;

@Component({
    inject: {
        fileManager: 'fileManager'
    },
    watch: {
        file: function(newFile: Object, oldFile: Object) {
            const _this: FileRow = this;
            _this._updateValue();
        },
        tag: function(newTag: string, oldTag: string) {
            const _this: FileRow = this;
            _this._updateValue();
        },
    }
})
export default class FileRow extends Vue {
    @Prop() file: Object;
    @Prop() tag: string;
    value: string = '';
    isFocused: boolean = false;
    isFormula: boolean = false;

    @Inject() fileManager!: FileManager;

    get backgroundColor(): string {
        if (this.tag === 'color') {
            return this.value || '#00ff00';
        } else {
            return 'inherit';
        }
    }

    get color(): string {
        const background = this.backgroundColor;
        if (background === 'inherit') {
            return 'inherit';
        } else if(background[0] === '#' && background.length !== 7 && background.length !== 4) {
            return '#000000';
        }else {
            return invertColor(colorConvert.toHex(this.backgroundColor), true);
        }
    }

    private _sub: SubscriptionLike;

    constructor() {
        super();
    }

    valueChanged(file: File, tag: string, value: string) {
        if (file.type === 'object') {
            this.$emit('tagChanged', tag);
            this.fileManager.updateFile(file, {
                tags: {
                    [tag]: value
                }
            });
        }
    }

    focus() {
        this.isFocused = true;
        this._updateValue();

        this.$emit('focusChanged', true);
    }

    blur() {
        this.isFocused = false;
        this._updateValue();
        this._updateAssignment();

        this.$emit('focusChanged', false);
    }

    created() {
        this._updateValue();
    }

    private _updateValue() {
        this.isFormula = isFormula(this.file.tags[this.tag]);
        if (!this.isFocused) {
            this.value = this.fileManager.calculateFormattedFileValue(this.file, this.tag);
        } else {
            const val = this.file.tags[this.tag];
            if (isAssignment(val)) {
                const assignment: Assignment = val;
                this.value = assignment.editing ? assignment.formula : assignment.value;
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
                this.fileManager.updateFile(this.file, {
                    tags: {
                        [this.tag]: assign(assignment, {
                            editing: false
                        })
                    }
                });
            }
        }
    }
};