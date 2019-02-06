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
                return `Tags cannot contain ${errors['tag.invalidChar'].char}.`;
            }
        }
        if (this.tagExists) {
            return 'This tag already exists.';
        }

        return null;
    }

    onInput(value: string) {
        this.$emit('input', value);
        this.$nextTick(() => {
            this.changed = true;
            const error = this.errorMessage;
            this.$emit('valid', !error);
        });
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
};