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
import BotTag from '../BotTag/BotTag';
import BotValue from '../BotValue/BotValue';
import type { SystemPortalDiffSelectionTag } from '@casual-simulation/aux-vm-browser';

import type { Bot } from '@casual-simulation/aux-common';
import { getBotTag, getShortId } from '@casual-simulation/aux-common';
import DiffStatus from '../DiffStatus/DiffStatus';

@Component({
    components: {
        'bot-tag': BotTag,
        'bot-value': BotValue,
        'diff-status': DiffStatus,
    },
})
export default class SystemPortalDiffTag extends Vue {
    @Prop() originalBotSimId: string;
    @Prop() originalBot: Bot;
    @Prop() modifiedBotSimId: string;
    @Prop() modifiedBot: Bot;
    @Prop() tag: SystemPortalDiffSelectionTag;

    @Prop({}) selected: boolean;

    @Prop({ default: false }) isReadOnly: boolean;

    get status() {
        return this.tag.status;
    }

    focusChanged(focused: boolean) {
        this.$emit('focusChanged', focused);
    }

    onClick() {
        this.$emit('click');
    }

    focus() {
        (this.$refs.valueEditor as BotValue)?.focus();
    }

    getBotValue(bot: Bot) {
        if (this.tag.name === 'id') {
            return getShortId(bot);
        } else {
            return getBotTag(bot, this.tag.name);
        }
    }
}
