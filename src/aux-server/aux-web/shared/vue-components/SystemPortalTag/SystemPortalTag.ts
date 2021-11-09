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
import { Bot } from '@casual-simulation/aux-common';

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

    focusChanged(focused: boolean) {
        this.$emit('focusChanged', focused);
    }

    onClick() {
        this.$emit('click');
    }
}
