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
import type { Subscription } from 'rxjs';
import { messages } from '../../Console';
import type { ConsoleMessages } from '@casual-simulation/aux-common';
import ConsoleMessage from '../ConsoleMessage/ConsoleMessage';
import { Prop } from 'vue-property-decorator';

@Component({
    components: {
        'console-message': ConsoleMessage,
    },
})
export default class Console extends Vue {
    private _sub: Subscription;

    consoleMessages: ConsoleMessages[];
    sources: string[];
    selectedSources: string[];

    @Prop({ default: () => <string[]>[] }) autoSelectSources: string[];

    get filteredMessages() {
        return this.consoleMessages.filter(
            (m) => this.selectedSources.indexOf(m.source) >= 0
        );
    }

    constructor() {
        super();
        this.consoleMessages = [];
        this.selectedSources = [];
        this.sources = [];
    }

    close() {
        this.$emit('close');
    }

    created() {
        this._sub = messages.subscribe((m) => {
            this.consoleMessages.unshift(m);
            if (this.sources.indexOf(m.source) < 0) {
                this.sources.push(m.source);
                if (this.autoSelectSources.indexOf(m.source) >= 0) {
                    this.selectedSources.push(m.source);
                }
            }
        });
    }

    beforeDestroy() {
        this._sub.unsubscribe();
        this._sub = null;
    }
}
