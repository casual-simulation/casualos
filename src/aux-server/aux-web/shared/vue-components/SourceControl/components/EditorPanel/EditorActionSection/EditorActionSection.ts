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
import type { SourceControlController } from '../../../../../SourceControlProvider';
import { SccEditorPanel } from '../../../../../SourceControlProvider';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';

@Component({
    name: 'editor-action-section',
})
export default class EditorActionSection extends Vue {
    @Prop({ required: true }) readonly scc: SourceControlController;
    finalRepoName = '';
    finalWorkingDir = '';
    activeSetupOption: string = 'init';

    get setupOption() {
        return this.activeSetupOption;
    }
    set setupOption(value: string) {
        this.activeSetupOption = value;
    }

    get repoName() {
        return this.finalRepoName;
    }
    set repoName(value: string) {
        this.finalRepoName = this.scc.sanitizeFSName(value);
    }
    get workingDir() {
        return this.finalWorkingDir;
    }
    set workingDir(value: string) {
        this.finalWorkingDir = this.scc.sanitizeFSPath(value);
    }

    constructor() {
        super();
    }

    filterKey(e: KeyboardEvent) {
        const char = String.fromCharCode(e.which || e.keyCode);
        if (!/^[A-Za-z0-9_]$/.test(char)) {
            e.preventDefault();
        }
    }

    filterPathKey(e: KeyboardEvent) {
        const char = String.fromCharCode(e.which || e.keyCode);
        if (!/^[A-Za-z0-9_./]$/.test(char)) {
            e.preventDefault();
        }
    }

    submitForm() {
        if (!this.repoName) {
            return;
        }
        this.scc.reactiveStore.instanceWorkingDirectory = this.workingDir;
        this.scc.reactiveStore.editorPanel.initialize.repoName = this.repoName;
        this.scc.init();
    }

    get SccEditorPanel() {
        return SccEditorPanel;
    }

    get reactiveStore() {
        return this.scc.reactiveStore;
    }
}
