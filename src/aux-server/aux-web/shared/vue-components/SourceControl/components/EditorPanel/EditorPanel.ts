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
import BotLibrary from '../../../BotLibrary/BotLibrary.vue';
import OutputLogs from './OutputLogs/OutputLogs.vue';
import EditorActionSection from './EditorActionSection/EditorActionSection.vue';
import type { SourceControlController } from 'aux-web/shared/SourceControlProvider';

@Component({
    name: 'editor-panel',
    components: {
        'search-bot-library': BotLibrary,
        'editor-action-section': EditorActionSection,
        'output-logs': OutputLogs,
    },
})
export default class EditorPanel extends Vue {
    @Prop({ required: true }) readonly scc: SourceControlController;

    get reactiveStore() {
        return this.scc.reactiveStore;
    }

    private rect: DOMRect | null = null;

    ratio = 0.7;
    dragging = false;

    get topFlex() {
        return `${this.ratio} 1 0`;
    }
    get bottomFlex() {
        return `${1 - this.ratio} 1 0`;
    }

    onDown(e: MouseEvent | TouchEvent) {
        e.preventDefault();
        document.documentElement.classList.add('html-dragging');
        this.dragging = true;
        this.rect = (
            this.$refs.container as HTMLElement
        ).getBoundingClientRect();

        const move = (ev: MouseEvent | TouchEvent) => {
            const clientY =
                (ev as MouseEvent).clientY ??
                ((ev as TouchEvent).touches &&
                    (ev as TouchEvent).touches[0]?.clientY);

            if (!this.rect || clientY == null) return;
            const r = (clientY - this.rect.top) / this.rect.height;
            this.ratio = Math.max(0.5, Math.min(0.8, r));
        };

        const up = () => {
            document.documentElement.classList.remove('html-dragging');
            this.dragging = false;
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', up);
        };

        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', up);
    }

    constructor() {
        super();
    }
}
