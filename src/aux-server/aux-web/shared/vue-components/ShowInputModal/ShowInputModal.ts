import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { wrapHtmlWithSandboxContentSecurityPolicy } from '../../../shared/SharedUtils';
import {
    ShowInputType,
    ShowInputSubtype,
    ShowInputOptions,
    BotCalculationContext,
    calculateFormattedBotValue,
    Bot,
    ShowInputForTagAction,
} from '@casual-simulation/aux-common';
import { Swatches, Chrome, Compact } from 'vue-color';

@Component({
    components: {
        'color-picker-swatches': Swatches,
        'color-picker-advanced': Chrome,
        'color-picker-basic': Compact,
    },
})
export default class ShowInputModal extends Vue {
    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    inputDialogLabel: string = '';
    inputDialogPlaceholder: string = '';
    inputDialogInput: string = '';
    inputDialogType: ShowInputType = 'text';
    inputDialogSubtype: ShowInputSubtype = 'basic';
    inputDialogInputValue: any = '';
    inputDialogLabelColor: string = '#000';
    inputDialogBackgroundColor: string = '#FFF';
    showInputDialog: boolean = false;

    private _inputDialogTarget: Bot = null;
    private _inputDialogSimulation: Simulation = null;

    created() {
        this._sub = new Subscription();
        this._simulationSubs = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._simulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._simulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    private _simulationAdded(sim: Simulation): void {
        let sub = new Subscription();
        this._sub.add(sub);

        sub.add(
            sim.localEvents.subscribe(e => {
                if (e.type === 'show_input_for_tag') {
                    setTimeout(() => {
                        this._showInputDialog(sim, e);
                    });
                }
            })
        );
    }

    private _simulationRemoved(sim: Simulation): void {
        const sub = this._simulationSubs.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulationSubs.delete(sim);
    }

    private _showInputDialog(
        simulation: Simulation,
        event: ShowInputForTagAction
    ) {
        const calc = simulation.helper.createContext();
        const bot = simulation.helper.botsState[event.botId];
        this._updateLabel(calc, bot, event.tag, event.options);
        this._updateColor(calc, bot, event.options);
        this._updateInput(calc, bot, event.tag, event.options);
        this._inputDialogSimulation = simulation;
        this.showInputDialog = true;
    }

    updateInputDialogColor(newColor: any) {
        if (typeof newColor === 'object') {
            this.inputDialogInputValue = newColor.hex;
        } else {
            this.inputDialogInputValue = newColor;
        }
    }

    autoFocusInputDialog() {
        // wait for the transition to finish
        setTimeout(
            () => {
                const field = <Vue>this.$refs.inputModalField;
                if (field) {
                    field.$el.focus();
                }
            },
            // 0.11 seconds (transition is 0.1 seconds)
            1000 * 0.11
        );
    }

    async closeInputDialog() {
        if (this.showInputDialog) {
            await this._inputDialogSimulation.helper.action('onCloseInput', [
                this._inputDialogTarget,
            ]);
            this.showInputDialog = false;
        }
    }

    async saveInputDialog() {
        let value: any;
        if (
            this.inputDialogType === 'color' &&
            typeof this.inputDialogInputValue === 'object'
        ) {
            value = this.inputDialogInputValue.hex;
        } else {
            value = this.inputDialogInputValue;
        }
        await this._inputDialogSimulation.helper.updateBot(
            this._inputDialogTarget,
            {
                tags: {
                    [this.inputDialogInput]: value,
                },
            }
        );
        await this._inputDialogSimulation.helper.action('onSaveInput', [
            this._inputDialogTarget,
        ]);
        await this.closeInputDialog();
    }

    private _updateColor(
        calc: BotCalculationContext,
        bot: Bot,
        options: Partial<ShowInputOptions>
    ) {
        if (typeof options.backgroundColor !== 'undefined') {
            this.inputDialogBackgroundColor = options.backgroundColor;
        } else {
            this.inputDialogBackgroundColor = '#FFF';
        }
    }

    private _updateLabel(
        calc: BotCalculationContext,
        bot: Bot,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        if (typeof options.title !== 'undefined') {
            this.inputDialogLabel = options.title;
        } else {
            this.inputDialogLabel = null; // tag;
        }

        if (typeof options.foregroundColor !== 'undefined') {
            this.inputDialogLabelColor = options.foregroundColor;
        } else {
            this.inputDialogLabelColor = '#000';
        }
    }

    private _updateInput(
        calc: BotCalculationContext,
        bot: Bot,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        this.inputDialogInput = tag;
        this.inputDialogType = options.type || 'text';
        this.inputDialogSubtype = options.subtype || 'basic';
        this._inputDialogTarget = bot;
        this.inputDialogInputValue =
            calculateFormattedBotValue(
                calc,
                this._inputDialogTarget,
                this.inputDialogInput
            ) || '';

        if (typeof options.placeholder !== 'undefined') {
            this.inputDialogPlaceholder = options.placeholder;
        } else {
            this.inputDialogPlaceholder = this.inputDialogInput;
        }
    }
}
