/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { validateTag, KNOWN_TAGS } from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';

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

    @Prop({ default: () => KNOWN_TAGS.slice() }) autoCompleteItems: string[];

    @Prop({ default: 'newTag' }) placeholder: string;
    @Prop({ default: false }) stopAutoCompleteKeyboardEvents: boolean;

    changed: boolean = false;
    focused: boolean = false;

    isOpen: boolean = true;
    isLoading: boolean = false;

    results: string[] = [];
    lastResultCount: number = 0;

    private _lastAutoFillTime: number = 0;

    get botManager() {
        return appManager.simulationManager.primary;
    }

    get showMenu() {
        return (
            this.focused &&
            this.changed &&
            (this.results.length > 0 || this.errorMessage)
        );
    }

    onEnter() {
        console.log('enter');
    }

    private _updateMenuItems() {
        if (this.value.length > 0) {
            // call the sort applicable tags function here
            this.results = this._sortAutoCompleteItems();
            if (this.results.length != this.lastResultCount) {
                this.isOpen = false;
                this.lastResultCount = this.results.length;

                this.$nextTick(() => {
                    this.isOpen = true;
                });
            }
        }
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
            this._updateMenuItems();
            this.changed = true;
            const error = this.errorMessage;
            this.$emit('valid', !error);
        });
    }

    // TODO: Improve to be able to prevent the form submision when using the enter key.
    // Need to prevent onAutoFill from being called by VueJS. (it is keeping the element highlighted even though the autocomplete menu is gone)
    // Solution is probably to handle the keyboard navigation events manually/
    // handleKeyEvent(event: KeyboardEvent) {
    //     if (this.stopAutoCompleteKeyboardEvents) {
    //         if ((Date.now() - this._lastAutoFillTime) < 100) {
    //             event.preventDefault();
    //         }
    //     }
    // }

    private _sortAutoCompleteItems(): string[] {
        let itemsToSort = this.autoCompleteItems.slice().sort(); // and tags on bots

        let finalTags = [];

        for (let i = 0; i < itemsToSort.length; i++) {
            const tag = itemsToSort[i];
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
        console.log('autofill', fillValue);
        this._lastAutoFillTime = Date.now();
        this.changed = true;
        this.$emit('autoFill', fillValue);
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
