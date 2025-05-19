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
import type { Bot } from '@casual-simulation/aux-common';
import SimpleTagEditor from '../SimpleTagEditor/SimpleTagEditor';
import MonacoLoader from '../MonacoLoader/MonacoLoader';
import MonacoLoaderError from '../MonacoLoaderError/MonacoLoaderError';
import type MonacoTagEditor from '../MonacoTagEditor/MonacoTagEditor';
import type monaco from '@casual-simulation/monaco-editor';
import EmptyComponent from '../EmptyComponent/EmptyComponent';

const MonacoAsync = () => ({
    component:
        import.meta.env.MODE === 'static'
            ? Promise.resolve(EmptyComponent)
            : import('../MonacoTagEditor/MonacoTagEditor').catch((err) => {
                  console.error('Unable to load Monaco editor:', err);
                  throw err;
              }),
    loading: MonacoLoader,
    error: MonacoLoaderError,

    delay: 50,
    timeout: 1000 * 60 * 5, // 5 minutes
});

@Component({
    components: {
        'monaco-editor': <any>MonacoAsync,
        'simple-editor': SimpleTagEditor,
    },
})
export default class TagValueEditor extends Vue {
    @Prop({ required: true }) simId: string;
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) bot: Bot;
    @Prop({ required: true }) space: string;
    @Prop({ default: false }) showDesktopEditor: boolean;
    @Prop({ default: true }) showResize: boolean;

    monacoEditor() {
        return this.$refs.monacoEditor as MonacoTagEditor;
    }

    onFocused(focused: boolean) {
        this.$emit('onFocused', focused);
    }

    onModelChanged(event: monaco.editor.IModelChangedEvent) {
        this.$emit('modelChanged', event);
    }

    /**
     * Attempts to focus this editor.
     * Returns true if successful.
     * Returns false if unable to focus the editor.
     * @returns
     */
    focusEditor(): boolean {
        const editor = this.monacoEditor();
        if (editor) {
            editor.editor.focus();
            return true;
        }
        return false;
    }

    constructor() {
        super();
    }
}
