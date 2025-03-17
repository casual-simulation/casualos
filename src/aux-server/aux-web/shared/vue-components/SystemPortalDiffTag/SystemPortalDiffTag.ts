import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import BotTag from '../BotTag/BotTag';
import BotValue from '../BotValue/BotValue';
import type { SystemPortalDiffSelectionTag } from '@casual-simulation/aux-vm-browser';
import {
    BrowserSimulation,
    SystemPortalBot,
    SystemPortalItem,
    SystemPortalSelectionTag,
    TagSortMode,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
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
