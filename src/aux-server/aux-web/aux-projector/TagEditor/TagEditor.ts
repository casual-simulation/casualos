import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch } from 'vue-property-decorator';
import { validateTag } from '@yeti-cgi/aux-common';
import { appManager } from '../../shared/AppManager';
import CombineIcon from '../public/icons/combine_icon.svg';

/**
 * A component that manages the logic for editing a tag name.
 * Used for new tags and potentially for allowing users to change tag names.
 */
@Component({
    components: {
        'combine-icon': CombineIcon
    }
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

    get placeholder() {
        if (this.isAction) {
            return '(#tag:"value")';
        } else {
            return 'newTag';
        }
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
            return this.value.slice(1) || '';
        } else {
            return this.value || '';
        }
    }

    onInput(event: any) {
        this.$nextTick(() => {
            this.$emit('input', this._convertToFinalValue(event.target.value));
            this.changed = true;
            const error = this.errorMessage;
            this.$emit('valid', !error);
        });
    }

    // onInput(event: string) {
    //     this.$nextTick(() => {
    //         this.$emit('input', this._convertToFinalValue(event));
    //         this.changed = true;
    //         const error = this.errorMessage;
    //         this.$emit('valid', !error);
    //     });
    // }

    focus() {
        
        let element: any = this.$refs.inputBox;
        let html: HTMLInputElement;
        if (element.focus) {
            html = element;
        } else {
            html = <HTMLInputElement>(<Vue>element).$el;
        }
        html.focus();
        setTimeout(() => {
            html.setSelectionRange(0, 9999);
        }, 0);
    }

    onFocus() {
        this.focused = true;
        (<any>this.$refs.mdField).MdField.focused = true;
    }

    onBlur() {
        this.focused = false;
        (<any>this.$refs.mdField).MdField.focused = false;
    }

    constructor() {
        super();
        this.changed = false;
        this.focused = false;
    }

    mounted() {
        this.focus();
    }

    private _convertToFinalValue(value: string) {
        return this.isAction ? `+${value}` : value;
    }
};