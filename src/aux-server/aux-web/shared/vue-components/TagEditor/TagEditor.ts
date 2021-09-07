import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { validateTag, KNOWN_TAGS } from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { EventBus } from '@casual-simulation/aux-components';

/**
 * A component that manages the logic for editing a tag name.
 * Used for new tags and potentially for allowing users to change tag names.
 */
@Component({
    components: {},
})
export default class TagEditor extends Vue {
    @Prop() value: string;
    @Prop() tagExists: boolean;
    @Prop({ default: false })
    useMaterialInput: boolean;

    changed: boolean = false;
    focused: boolean = false;

    isOpen: boolean = true;
    isLoading: boolean = false;

    results: string[] = [];
    lastResultCount: number = 0;

    get botManager() {
        return appManager.simulationManager.primary;
    }

    get showMenu() {
        if (this.value.length > 0) {
            // call the sort applicable tags function here
            this.results = this.sortTags();
            if (this.results.length != this.lastResultCount) {
                this.isOpen = false;
                this.lastResultCount = this.results.length;

                this.$nextTick(() => {
                    this.isOpen = true;
                });
            }
        }

        return !!(
            this.focused &&
            this.changed &&
            (this.errorMessage || this.results.length > 0)
        );
    }

    get placeholder() {
        return 'newTag';
    }

    get errorMessage() {
        const errors = validateTag(this.value);
        if (!errors.valid) {
            if (errors['tag.required']) {
                return 'You must provide a value.';
            } else if (errors['tag.invalidChar']) {
                return `Tags cannot contain ${errors['tag.invalidChar'].char}.`;
            }
        }
        if (this.tagExists) {
            return 'This tag already exists.';
        }

        return null;
    }

    get editorValue() {
        return this.value || '';
    }

    onInput(event: any) {
        this.$nextTick(() => {
            this.$emit('input', this._convertToFinalValue(event.target.value));
            this.changed = true;
            const error = this.errorMessage;
            this.$emit('valid', !error);
        });
    }

    sortTags(): string[] {
        let tagsToSort = KNOWN_TAGS.sort(); // and tags on bots

        let finalTags = [];

        for (let i = 0; i < tagsToSort.length; i++) {
            const tag = tagsToSort[i];
            if (
                tag.toLowerCase().startsWith(this.value.toLowerCase()) &&
                (!this.tagExists || tag !== this.value)
            ) {
                if (tag.startsWith('aux._')) {
                    if (this.value.toLowerCase().startsWith('aux._')) {
                        finalTags.push(tag);
                    }
                } else {
                    finalTags.push(tag);
                }
            }
        }

        return finalTags;
    }

    onAutoFill(fillValue: string) {
        //this.$emit('input', this._convertToFinalValue(fillValue));
        this.changed = true;
        EventBus.$emit('AutoFill', fillValue);
    }

    focus() {
        const html = this._getElement();
        setTimeout(() => {
            html.focus();
            setTimeout(() => {
                html.setSelectionRange(0, 9999);
            }, 0);
        }, 101);
    }

    onFocus() {
        this.focused = true;
        const field = (<any>this.$refs.mdField)?.MdField;
        if (field) {
            field.focused = true;
        }
    }

    onBlur() {
        this.focused = false;
        const field = (<any>this.$refs.mdField)?.MdField;
        if (field) {
            field.focused = false;
        }
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
        return value;
    }

    private _getElement() {
        let element: any = this.$refs.inputBox;
        let html: HTMLInputElement;
        if (element.focus) {
            html = element;
        } else {
            html = <HTMLInputElement>(<Vue>element).$el;
        }
        return html;
    }
}
