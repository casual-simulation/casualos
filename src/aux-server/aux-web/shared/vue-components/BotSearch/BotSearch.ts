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
import { Prop, Watch, Provide } from 'vue-property-decorator';
import type { Bot } from '@casual-simulation/aux-common';
import {
    formatValue,
    tagsOnBot,
    hasValue,
    runScript,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import type { SubscriptionLike } from 'rxjs';
import MiniBot from '../MiniBot/MiniBot';
import type { BotRenderer } from '../../scene/BotRenderer';
import { getRenderer } from '../../scene/BotRenderer';
import { SvgIcon } from '@casual-simulation/aux-components';

@Component({
    components: {
        'mini-bot': MiniBot,
        'svg-icon': SvgIcon,
    },
})
export default class BotSearch extends Vue {
    isOpen: boolean = false;
    bots: Bot[] = [];
    recentBot: Bot = null;
    search: string = '';

    @Prop({ default: null }) prefill: string;

    @Provide() botRenderer: BotRenderer = getRenderer();

    toggleOpen() {}

    async executeSearch() {
        await appManager.simulationManager.primary.helper.transaction(
            runScript(this.search)
        );
    }

    @Watch('search')
    onSearchChanged() {}

    setPrefill(prefill: string) {
        if (!prefill) {
            return;
        }
        if (!hasValue(this.search)) {
            this.search = prefill;
        }
    }

    get placeholder() {
        if (this.bots.length > 0) {
            let val = formatValue(this.bots);

            if (!this.bots.every((f) => this.isEmptyOrDiff(f))) {
                if (val.length > 50) {
                    val = val.substring(0, 50) + '..';
                }
                return val;
            } else {
                return 'Search / Run';
            }
        } else {
            return 'Search / Run';
        }
    }

    constructor() {
        super();
    }

    get botsLength() {
        let num = 0;
        let temp = this.bots.length;
        if (temp !== 1) {
            num = this.bots.length;
        } else {
            if (this.isEmptyOrDiff(this.bots[0])) {
                num = 0;
            } else {
                num = 1;
            }
        }

        return num;
    }

    uiHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.botQueue];
    }

    mounted() {
        appManager.whileLoggedIn((botManager) => {
            let subs: SubscriptionLike[] = [];
            subs.push(
                botManager.botPanel.botsUpdated.subscribe((e) => {
                    this.bots = e.bots;
                })
            );
            return subs;
        });

        this.setPrefill(this.prefill);
    }

    isEmptyOrDiff(f: Bot): boolean {
        return tagsOnBot(f).length === 0 || f.id === 'mod';
    }

    startSearch() {
        const search = <Vue>this.$refs.searchInput;
        if (search) {
            (search.$el as HTMLElement).focus();
        }
    }
}
