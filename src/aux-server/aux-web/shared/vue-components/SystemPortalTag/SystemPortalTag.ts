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
import type { SystemPortalSelectionTag } from '@casual-simulation/aux-vm-browser';

import type { Bot } from '@casual-simulation/aux-common';
import { getBotTag, getShortId } from '@casual-simulation/aux-common';

@Component({
    components: {
        'bot-tag': BotTag,
        'bot-value': BotValue,
    },
})
export default class SystemPortalTag extends Vue {
    @Prop({ required: true }) simId: string;
    @Prop({}) tag: SystemPortalSelectionTag;
    @Prop({}) selected: boolean;
    @Prop({}) bot: Bot;
    @Prop({ default: false }) showCloseButton: boolean;
    @Prop({ default: true }) showPinButton: boolean;
    @Prop({ default: false }) isReadOnly: boolean;

    get activeTheme() {
        return `md-theme-${(Vue as any).material.theming.theme || 'default'}`;
    }

    focusChanged(focused: boolean) {
        this.$emit('focusChanged', focused);
    }

    onClick() {
        this.$emit('click');
    }

    onClose() {
        this.$emit('close');
    }

    onPin() {
        this.$emit('pin');
    }

    focus() {
        (this.$refs.valueEditor as BotValue)?.focus();
    }

    getBotValue() {
        if (this.tag.name === 'id') {
            return getShortId(this.bot);
        } else {
            return getBotTag(this.bot, this.tag.name);
        }
    }
}
