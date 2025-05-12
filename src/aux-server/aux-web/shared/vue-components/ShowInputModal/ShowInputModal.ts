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
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import type { Simulation } from '@casual-simulation/aux-vm';
import type {
    ShowInputType,
    ShowInputSubtype,
    ShowInputOptions,
    BotCalculationContext,
    Bot,
    ShowInputForTagAction,
    ShowInputAction,
    ShowInputItem,
} from '@casual-simulation/aux-common';
import {
    calculateFormattedBotValue,
    asyncResult,
} from '@casual-simulation/aux-common';
import { Swatches, Chrome, Compact } from 'vue-color';
import { getCurrentTheme } from '../../StyleHelpers';

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
    private _saved: boolean;

    currentLabel: string = '';
    currentPlaceholder: string = '';
    currentType: ShowInputType = 'text';
    currentSubtype: ShowInputSubtype = 'basic';
    currentValue: any = '';
    labelColor: string = '#000';
    backgroundColor: string = '#FFF';
    showInputDialog: boolean = false;
    autoSelect: boolean = false;
    items: ShowInputItem[] = [];

    private _currentTag: string = '';
    private _currentBot: Bot = null;
    private _currentTask: number | string = null;
    private _inputDialogSimulation: Simulation = null;

    get hasTextInput() {
        return (
            this.currentType === 'text' ||
            this.currentType === 'color' ||
            this.currentType === 'secret'
        );
    }

    get isSelect() {
        return (
            this.currentType === 'list' &&
            this.currentSubtype !== 'radio' &&
            this.currentSubtype !== 'checkbox'
        );
    }

    created() {
        this._sub = new Subscription();
        this._simulationSubs = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._simulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._simulationRemoved(sim)))
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
            sim.localEvents.subscribe((e) => {
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
        this.items = event.options.items ?? [];
        this._inputDialogSimulation = simulation;
        this.autoSelect = !!(event.options.autoSelect || false);
        this.showInputDialog = true;
        this._saved = false;
    }

    private _showInput(simulation: Simulation, event: ShowInputAction) {
        this._currentBot = null;
        this._currentTag = null;
        this._updateLabel(event.options);
        this._updateColor(event.options);
        this._updateInput(event.currentValue, event.options, '');
        this.items = event.options.items ?? [];
        this._inputDialogSimulation = simulation;
        this._currentTask = event.taskId;
        this.autoSelect = !!(event.options.autoSelect || false);
        this.showInputDialog = true;
        this._saved = false;
    }

    updateInputDialogColor(newColor: any) {
        if (typeof newColor === 'object') {
            this.currentValue = newColor.hex;
        } else {
            this.currentValue = newColor;
        }

        if (this.currentSubtype !== 'advanced') {
            // The advanced color subtype has a full color picker.
            // Chosing a color from it should not automatically close the sheet
            // since it is common to click around to find something you like.
            this.saveInputDialog();
        }
    }

    autoFocusInputDialog() {
        // wait for the transition to finish
        setTimeout(
            () => {
                const field = <Vue>this.$refs.inputModalField;
                if (field) {
                    (field.$el as HTMLElement).focus();
                    if (this.autoSelect) {
                        const input = field.$el as HTMLInputElement;
                        input.setSelectionRange(0, input.value.length);
                    }
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
        if (this._saved) {
            return;
        }
        let value: any;
        if (
            this.currentType === 'color' &&
            typeof this.currentValue === 'object'
        ) {
            value = this.currentValue.hex;
        } else if (this.currentType === 'date') {
            if (typeof this.currentValue === 'string') {
                value = parseYearMonthDayDate(this.currentValue);
            } else if (typeof this.currentValue === 'number') {
                value = new Date(this.currentValue);
            } else {
                value = this.currentValue;
            }
        } else if (this.currentType === 'list') {
            if (Array.isArray(this.currentValue)) {
                value = this.currentValue.map((v) => this.items[v]);
            } else {
                value = this.items[this.currentValue];
            }
        } else {
            value = this.currentValue;
        }

        const currentBot = this._currentBot;
        const currentTag = this._currentTag;
        const currentTask = this._currentTask;
        // Close the dialog first before
        // sending the result events back to the backend.
        // This will let dialogs be opened in sequence.
        this._saved = true;
        await this.closeInputDialog();

        if (currentBot && currentTag) {
            await this._saveInputForTag(currentBot, currentTag, value);
        } else if (
            typeof currentTask === 'number' ||
            typeof currentTask === 'string'
        ) {
            await this._saveInput(currentTask, value);
        } else {
            console.error(
                '[ShowInputModal] Unable to save since no bot or task was specified'
            );
        }
    }

    private async _saveInput(currentTask: string | number, value: any) {
        await this._inputDialogSimulation.helper.transaction(
            asyncResult(currentTask, value)
        );
    }

    private async _saveInputForTag(
        currentBot: Bot,
        currentTag: string,
        value: any
    ) {
        await this._inputDialogSimulation.helper.updateBot(currentBot, {
            tags: {
                [currentTag]: value,
            },
        });
        await this._inputDialogSimulation.helper.action('onSaveInput', [
            currentBot,
        ]);
    }

    private _updateColor(options: Partial<ShowInputOptions>) {
        if (typeof options.backgroundColor !== 'undefined') {
            this.backgroundColor = options.backgroundColor;
        } else {
            const theme = getCurrentTheme();
            if (theme === 'dark') {
                this.backgroundColor = null;
            } else {
                this.backgroundColor = '#FFF';
            }
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
            const theme = getCurrentTheme();
            if (theme === 'dark') {
                this.labelColor = null;
            } else {
                this.labelColor = '#000';
            }
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
        this.currentType = options.type || 'text';
        this.currentSubtype = options.subtype || 'basic';
        this.currentValue =
            currentValue ??
            (this.currentType === 'date'
                ? null
                : this.currentType === 'list' &&
                  (this.currentSubtype === 'checkbox' ||
                      this.currentSubtype === 'multiSelect')
                ? []
                : '');

        if (typeof options.placeholder !== 'undefined') {
            this.currentPlaceholder = options.placeholder;
        } else {
            this.currentPlaceholder = defaultPlaceholder;
        }
    }
}

/**
 * Parses the given date string in yyyy-MM-dd format and returns a Date object.
 */
function parseYearMonthDayDate(dateString: string) {
    const [year, month, day] = dateString.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
