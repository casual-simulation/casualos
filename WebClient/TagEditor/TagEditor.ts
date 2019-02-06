import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch } from 'vue-property-decorator';
import { validateTag } from 'common/Files/FileCalculations';
import { appManager } from '../AppManager';

/**
 * A component that manages the logic for editing a tag name.
 * Used for new tags and potentially for allowing users to change tag names.
 */
@Component({
})
export default class TagEditor extends Vue {

    @Prop() value: string;
    @Prop() tagExists: boolean;
    @Prop({ default: false }) isAction: boolean;
    @Prop({ default: false }) useMaterialInput: boolean;

    changed: boolean = false;
    focused: boolean = false;

    get fileManager() {
        return appManager.fileManager;
    }

    get showMenu() {
        return !!(this.focused && this.changed && this.errorMessage);
    }

    get errorMessage() {
        const errors = validateTag(this.value);
        if (!errors.valid) {
            if(errors['tag.required']) {
                return 'You must provide a value.';
            } else if(errors['tag.invalidChar']) {
                if (this.isAction && errors['tag.invalidChar'].char === '#') {
                    return 'Actions must start with (';
                } else {
                    return `Tags cannot contain ${errors['tag.invalidChar'].char}.`;
                }
            }
        }
        if (this.tagExists) {
            return 'This tag already exists.';
        }

        return null;
    }

    get editorValue() {
        if (this.isAction) {
            return this.value.slice(1);
        } else {
            return this.value;
        }
    }

    onInput(value: string) {
        this.$emit('input', this._convertToFinalValue(value));
        this.$nextTick(() => {
            this.changed = true;
            const error = this.errorMessage;
            this.$emit('valid', !error);
        });
    }

    focus() {
        const element = this.$refs.inputBox as HTMLElement;
        element.focus();
    }

    onFocus() {
        this.focused = true;
    }

    onBlur() {
        this.focused = false;
    }

    constructor() {
        super();
        this.changed = false;
        this.focused = false;
    }

    private _convertToFinalValue(value: string) {
        return this.isAction ? `+${value}` : value;
    }
};