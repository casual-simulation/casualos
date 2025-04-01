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
import { Prop, Watch } from 'vue-property-decorator';
import type { Bot } from '@casual-simulation/aux-common';
import { isFormula, isScript } from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';
import { appManager } from '../../AppManager';
import BotTag from '../BotTag/BotTag';
import { isFocused } from '../VueHelpers';

@Component({
    components: {
        'bot-tag': BotTag,
    },
})
export default class SimpleTagEditor extends Vue {
    @Prop({ required: true }) simId: string;
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) bot: Bot;

    tagValue: any = '';

    private _simulation: BrowserSimulation;
    private _sub: SubscriptionLike;

    get isTagFormula(): boolean {
        return isFormula(this.tagValue);
    }

    get isTagScript(): boolean {
        return isScript(this.tagValue);
    }

    @Watch('tag')
    tagChanged() {
        this._updateValue();
    }

    @Watch('bot')
    botChanged() {
        this._updateValue();
    }

    @Watch('tagValue')
    valueChanged() {
        let bot = this.bot;
        let tag = this.tag;
        let value = this.tagValue;
        this._updateBot(bot, tag, value);
    }

    created() {
        this._sub = appManager.simulationManager.watchSimulations((sim) => {
            if (sim.id === this.simId) {
                this._simulation = sim;
            }
            return new Subscription();
        });
        this._updateValue();
    }

    destroyed() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    private _updateBot(bot: Bot, tag: string, value: any) {
        if (!isFocused(this.$el as HTMLElement)) {
            return;
        }
        this._simulation.editBot(bot, tag, value);
    }

    private _updateValue() {
        if (isFocused(this.$el as HTMLElement)) {
            return;
        }

        if (this.tag && this.bot) {
            this.tagValue = this.bot.tags[this.tag];
        } else {
            this.tagValue = '';
        }
    }
}
