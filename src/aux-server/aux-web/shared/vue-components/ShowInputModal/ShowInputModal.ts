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
    ShowInputAction,
    asyncResult,
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

    currentLabel: string = '';
    currentPlaceholder: string = '';
    currentType: ShowInputType = 'text';
    currentSubtype: ShowInputSubtype = 'basic';
    currentValue: any = '';
    labelColor: string = '#000';
    backgroundColor: string = '#FFF';
    showInputDialog: boolean = false;

    private _currentTag: string = '';
    private _currentBot: Bot = null;
    private _currentTask: number = null;
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
                        this._showInputForTag(sim, e);
                    });
                } else if (e.type === 'show_input') {
                    this._showInput(sim, e);
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

    private _showInputForTag(
        simulation: Simulation,
        event: ShowInputForTagAction
    ) {
        const calc = simulation.helper.createContext();
        const bot = simulation.helper.botsState[event.botId];
        this._currentBot = bot;
        this._currentTag = event.tag;
        this._updateLabel(event.options);
        this._updateColor(event.options);
        this._updateInputForTag(calc, bot, event.tag, event.options);
        this._inputDialogSimulation = simulation;
        this.showInputDialog = true;
    }

    private _showInput(simulation: Simulation, event: ShowInputAction) {
        this._currentBot = null;
        this._currentTag = null;
        this._updateLabel(event.options);
        this._updateColor(event.options);
        this._updateInput(event.currentValue, event.options, '');
        this._inputDialogSimulation = simulation;
        this._currentTask = event.taskId;
        this.showInputDialog = true;
    }

    updateInputDialogColor(newColor: any) {
        if (typeof newColor === 'object') {
            this.currentValue = newColor.hex;
        } else {
            this.currentValue = newColor;
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
            if (this._currentBot) {
                await this._inputDialogSimulation.helper.action(
                    'onCloseInput',
                    [this._currentBot]
                );
            }
            this.showInputDialog = false;
        }
        this._currentBot = null;
        this._currentTag = null;
        this._currentTask = null;
    }

    async saveInputDialog() {
        let value: any;
        if (
            this.currentType === 'color' &&
            typeof this.currentValue === 'object'
        ) {
            value = this.currentValue.hex;
        } else {
            value = this.currentValue;
        }

        if (this._currentBot && this._currentTag) {
            await this._saveInputForTag(value);
        } else if (typeof this._currentTask === 'number') {
            await this._saveInput(value);
        } else {
            console.error(
                '[ShowInputModal] Unable to save since no bot or task was specified'
            );
        }
        await this.closeInputDialog();
    }

    private async _saveInput(value: any) {
        await this._inputDialogSimulation.helper.transaction(
            asyncResult(this._currentTask, value)
        );
    }

    private async _saveInputForTag(value: any) {
        await this._inputDialogSimulation.helper.updateBot(this._currentBot, {
            tags: {
                [this._currentTag]: value,
            },
        });
        await this._inputDialogSimulation.helper.action('onSaveInput', [
            this._currentBot,
        ]);
    }

    private _updateColor(options: Partial<ShowInputOptions>) {
        if (typeof options.backgroundColor !== 'undefined') {
            this.backgroundColor = options.backgroundColor;
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(options: Partial<ShowInputOptions>) {
        if (typeof options.title !== 'undefined') {
            this.currentLabel = options.title;
        } else {
            this.currentLabel = null; // tag;
        }

        if (typeof options.foregroundColor !== 'undefined') {
            this.labelColor = options.foregroundColor;
        } else {
            this.labelColor = '#000';
        }
    }

    private _updateInputForTag(
        calc: BotCalculationContext,
        bot: Bot,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        this._updateInput(
            calculateFormattedBotValue(
                calc,
                this._currentBot,
                this._currentTag
            ) || '',
            options,
            this._currentTag
        );
    }

    private _updateInput(
        currentValue: string,
        options: Partial<ShowInputOptions>,
        defaultPlaceholder: string
    ) {
        this.currentValue = currentValue || '';
        this.currentType = options.type || 'text';
        this.currentSubtype = options.subtype || 'basic';

        if (typeof options.placeholder !== 'undefined') {
            this.currentPlaceholder = options.placeholder;
        } else {
            this.currentPlaceholder = defaultPlaceholder;
        }
    }
}
