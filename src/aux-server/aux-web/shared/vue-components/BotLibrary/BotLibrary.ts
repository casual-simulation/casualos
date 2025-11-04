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
import type { Bot } from '@casual-simulation/aux-common';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';

/**
 * Vue component that displays a bot library capable of showing available bots
 * allowing users to select / interact with them.
 */
@Component({
    name: 'bot-library',
})
export default class BotLibrary extends Vue {
    @Prop({ required: true }) searchBotsBySystemOrId: (
        idOrSystem: string
    ) => Bot[];
    @Prop({ required: false }) onBotSelected: (bot: Bot) => void;
    queryResultBots: Bot[] = [];
    searchQuery: string = '';

    @Watch('searchQuery')
    searchBotsInput(query: string) {
        if (!this.searchBotsBySystemOrId) {
            return;
        }
        this.queryResultBots.length = 0;
        this.queryResultBots.push(...this.searchBotsBySystemOrId(query));
    }

    get botCount() {
        return this.queryResultBots?.length ?? 0;
    }

    get bots() {
        return this.queryResultBots;
    }

    constructor() {
        super();
        this.queryResultBots = [];
    }
}
