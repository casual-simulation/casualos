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
import { Inject, Watch, Prop } from 'vue-property-decorator';
import type { Bot } from '@casual-simulation/aux-common';
import { tagsOnBot } from '@casual-simulation/aux-common';
import type { BotRenderer } from '../../scene/BotRenderer';
import { appManager } from '../../AppManager';
import TagColor from '../TagColor/TagColor';
import { EventBus } from '@casual-simulation/aux-components';
import { debounce } from 'es-toolkit/compat';

@Component({
    components: {
        'tag-color': TagColor,
    },
})
export default class MiniBot extends Vue {
    @Prop() bot: Bot;
    @Prop({ default: false })
    large: boolean;
    @Prop({ default: false })
    selected: boolean;

    get diffball(): boolean {
        return this.bot && this.bot.id === 'mod';
    }

    @Prop({ default: false })
    isSearch: boolean;

    /**
     * Whether the bot should create a mod when dragged.
     */
    @Prop({ default: false })
    createMod: boolean;

    image: string = '';
    label: string = '';
    labelColor: string = '#000';
    isEmpty: boolean = false;

    @Inject() botRenderer: BotRenderer;

    @Watch('bot')
    private _botChanged(bot: Bot) {
        this._updateBot();
    }

    constructor() {
        super();
        this.image = '';
    }

    created() {
        this._updateBot = debounce(this._updateBot.bind(this), 100);
    }

    mounted() {
        this._botChanged(this.bot);
        EventBus.$on('bot_render_refresh', this._handleBotRenderRefresh);
    }

    beforeDestroy() {
        EventBus.$off('bot_render_refresh', this._handleBotRenderRefresh);
    }

    click() {
        this.$emit('click');
    }

    private async _updateBot() {
        this.image = await this.botRenderer.render(
            this.bot,
            appManager.simulationManager.primary.helper.createContext(),
            this.diffball
        );

        this.isEmpty = tagsOnBot(this.bot).length === 0;

        this.label =
            appManager.simulationManager.primary.helper.calculateFormattedBotValue(
                this.bot,
                'auxLabel'
            );
        if (this.label) {
            this.labelColor =
                appManager.simulationManager.primary.helper.calculateFormattedBotValue(
                    this.bot,
                    'auxLabelColor'
                );
            if (!this.labelColor) {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
        this.$forceUpdate();
    }

    private _handleBotRenderRefresh(bot: Bot): void {
        if (this.bot === bot) {
            this._botChanged(bot);
        }
    }
}
