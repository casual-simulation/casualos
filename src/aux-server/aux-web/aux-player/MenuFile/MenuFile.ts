import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Bot,
    BotCalculationContext,
    calculateFormattedFileValue,
    calculateBotValue,
    isFormula,
} from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { MenuItem } from '../MenuContext';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {},
})
export default class MenuFile extends Vue {
    @Prop() item: MenuItem;
    @Prop() index: number;
    @Prop({ default: false })
    selected: boolean;

    label: string = '';
    labelColor: string = '#000';
    backgroundColor: string = '#FFF';

    @Watch('item')
    private async _fileChanged(item: MenuItem) {
        if (item) {
            const simulation = _simulation(item);
            const calc = simulation.helper.createContext();
            this._updateLabel(calc, item.bot);
            this._updateColor(calc, item.bot);
        } else {
            this.label = '';
            this.labelColor = '#000';
            this.backgroundColor = '#FFF';
        }
    }

    constructor() {
        super();
    }

    mounted() {
        this._fileChanged(this.item);
    }

    async click() {
        const simulation = _simulation(this.item);
        await simulation.helper.action('onClick', [this.item.bot]);
    }

    private _updateColor(calc: BotCalculationContext, bot: Bot) {
        if (bot.tags['aux.color']) {
            this.backgroundColor = calculateBotValue(calc, bot, 'aux.color');
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: BotCalculationContext, bot: Bot) {
        let label = bot.tags['aux.label'];
        if (label) {
            this.label = calculateFormattedFileValue(calc, bot, 'aux.label');
            const labelColor = bot.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = calculateFormattedFileValue(
                    calc,
                    bot,
                    'aux.label.color'
                );
            } else {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
    }
}

function _simulation(item: MenuItem) {
    return appManager.simulationManager.simulations.get(item.simulationId);
}
