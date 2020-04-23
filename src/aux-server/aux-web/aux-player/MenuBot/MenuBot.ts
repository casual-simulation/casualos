import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Bot,
    BotCalculationContext,
    calculateFormattedBotValue,
    calculateBotValue,
    isFormula,
    BotLabelAlignment,
    getBotLabelAlignment,
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { DimensionItem } from '../DimensionItem';

@Component({
    components: {},
})
export default class MenuBot extends Vue {
    @Prop() item: DimensionItem;
    @Prop() index: number;
    @Prop({ default: false })
    selected: boolean;

    label: string = '';
    labelColor: string = '#000';
    labelAlign: BotLabelAlignment = 'center';
    backgroundColor: string = '#FFF';

    @Watch('item')
    private async _botChanged(item: DimensionItem) {
        if (item) {
            const simulation = _simulation(item);
            const calc = simulation.helper.createContext();
            this._updateLabel(calc, item.bot);
            this._updateColor(calc, item.bot);
            this._updateAlignment(calc, item.bot);
        } else {
            this.label = '';
            this.labelColor = '#000';
            this.labelAlign = 'center';
            this.backgroundColor = '#FFF';
        }
    }

    constructor() {
        super();
    }

    mounted() {
        this._botChanged(this.item);
    }

    async click() {
        const simulation = _simulation(this.item);
        await simulation.helper.action('onClick', [this.item.bot]);
    }

    private _updateColor(calc: BotCalculationContext, bot: Bot) {
        if (bot.tags['auxColor']) {
            this.backgroundColor = calculateBotValue(calc, bot, 'auxColor');
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: BotCalculationContext, bot: Bot) {
        let label = bot.tags['auxLabel'];
        if (label) {
            this.label = calculateFormattedBotValue(calc, bot, 'auxLabel');
            const labelColor = bot.tags['auxLabelColor'];
            if (labelColor) {
                this.labelColor = calculateFormattedBotValue(
                    calc,
                    bot,
                    'auxLabelColor'
                );
            } else {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
    }

    private _updateAlignment(calc: BotCalculationContext, bot: Bot) {
        this.labelAlign = getBotLabelAlignment(calc, bot);
    }
}

function _simulation(item: any) {
    return appManager.simulationManager.simulations.get(item.simulationId);
}
