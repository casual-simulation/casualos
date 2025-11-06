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
import { SccOutputLevel } from '../../../../../SourceControlProvider';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';

@Component({
    name: 'output-logs',
})
export default class OutputLogs extends Vue {
    @Prop({ required: true }) readonly scc: SourceControlController;
    constructor() {
        super();
    }

    get reactiveStore() {
        return this.scc.reactiveStore;
    }

    outputAutoScroll = true;

    downloadOutputLogs() {
        const logs = this.reactiveStore.outputPanel.logs
            .map((l) => `${l[0].tms}_${l[0].scope.join(' ')} ${l[1]}`)
            .join('\n');
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aux-source-control-output-logs-${Date.now()}.txt`;
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 1000);
    }

    clearOutputLogs() {
        this.reactiveStore.outputPanel.logs = [];
        this.scc.logOutput('Output logs cleared.', SccOutputLevel.Info);
    }
    @Watch('reactiveStore.outputPanel.logs')
    onLogsChanged() {
        if (this.outputAutoScroll === false) {
            return;
        }
        this.$nextTick(() => {
            const el = this.$refs.logs as HTMLElement;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
    }

    toggleOutputScroll() {
        this.outputAutoScroll = !this.outputAutoScroll;
    }
}
