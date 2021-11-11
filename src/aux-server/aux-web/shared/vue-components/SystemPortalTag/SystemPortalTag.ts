import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import BotTag from '../BotTag/BotTag';
import BotValue from '../BotValue/BotValue';
import {
    BrowserSimulation,
    SystemPortalBot,
    SystemPortalItem,
    SystemPortalSelectionTag,
    TagSortMode,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { Bot, getBotTag, getShortId } from '@casual-simulation/aux-common';

@Component({
    components: {
        'bot-tag': BotTag,
        'bot-value': BotValue,
    },
})
export default class SystemPortalTag extends Vue {
    @Prop({}) tag: SystemPortalSelectionTag;
    @Prop({}) selected: boolean;
    @Prop({}) bot: Bot;
    @Prop({ default: false }) showCloseButton: boolean;
    @Prop({ default: true }) showPinButton: boolean;
    @Prop({ default: false }) isReadOnly: boolean;

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
