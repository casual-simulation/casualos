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
import type { Bot } from '@casual-simulation/aux-common';
import {
    action,
    ANY_CLICK_ACTION_NAME,
    calculateFormattedBotValue,
    CLICK_ACTION_NAME,
    hasValue,
    isBotInDimension,
    onAnyClickArg,
    onClickArg,
    EDITOR_CODE_TOOL_PORTAL,
    calculateDimensions,
    getBotIndex,
} from '@casual-simulation/aux-common';
import type { BotDimensionsUpdate } from '@casual-simulation/aux-vm';
import type { BotManager } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { sortBy } from 'lodash';

interface CodeTool {
    label: string;
    dimension: string;
    botId: string;
    simId: string;
    index: number;
}

@Component({})
export default class CodeToolsPortal extends Vue {
    @Prop({ required: true }) simId: string;

    tools: CodeTool[] = [];

    private _sub: Subscription;
    private _simSub: Subscription;

    constructor() {
        super();
    }

    @Watch('simId')
    onSimIdChanged() {
        this._setup();
    }

    created() {
        this.tools = [];
        this._setup();
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
        if (this._simSub) {
            this._simSub.unsubscribe();
            this._simSub = null;
        }
    }

    clickTool(tool: CodeTool) {
        const sim = appManager.simulationManager.simulations.get(tool.simId);
        if (sim) {
            const bot = sim.helper.botsState[tool.botId];
            if (bot) {
                sim.helper.transaction(
                    action(
                        CLICK_ACTION_NAME,
                        [bot.id],
                        sim.helper.userId,
                        onClickArg(
                            null,
                            tool.dimension,
                            null,
                            null,
                            null,
                            null,
                            null
                        )
                    ),
                    action(
                        ANY_CLICK_ACTION_NAME,
                        null,
                        sim.helper.userId,
                        onAnyClickArg(
                            null,
                            tool.dimension,
                            bot,
                            null,
                            null,
                            null,
                            null,
                            null
                        )
                    )
                );
            }
        }
    }

    private _setup() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
        if (this._simSub) {
            this._simSub.unsubscribe();
            this._simSub = null;
        }
        this._sub = new Subscription();

        if (hasValue(this.simId)) {
            this._sub.add(
                appManager.simulationManager.simulationAdded.subscribe(
                    (sim) => {
                        if (sim.id === this.simId) {
                            this._onSimAdded(sim);
                        }
                    }
                )
            );

            this._sub.add(
                appManager.simulationManager.simulationRemoved.subscribe(
                    (sim) => {
                        if (sim.id === this.simId) {
                            this._onSimRemoved(sim);
                        }
                    }
                )
            );
        }
    }

    private _onSimRemoved(sim: BotManager) {
        if (this._simSub) {
            this._simSub.unsubscribe();
            this._simSub = null;
        }
    }

    private _onSimAdded(sim: BotManager) {
        if (this._simSub) {
            this._simSub.unsubscribe();
        }
        this._simSub = new Subscription();

        this._simSub.add(
            sim.dimensions
                .watchDimensions(
                    ['codeToolsPortal'],
                    (bot) => sim.helper.userId === bot.id
                )
                .subscribe((update) => {
                    this._dimensionsUpdated(sim, update);
                })
        );
    }

    private _dimensionsUpdated(sim: BotManager, update: BotDimensionsUpdate) {
        if (update.events.length > 0) {
            this._recalculateBots(sim);
        } else {
            let changed = false;
            for (let tool of this.tools) {
                let botId = tool.botId;

                for (let updatedBot of update.updatedBots) {
                    if (updatedBot.bot.id !== botId) {
                        continue;
                    } else {
                        const newTool = calculateTool(
                            updatedBot.bot,
                            tool.dimension,
                            sim
                        );
                        if (newTool) {
                            changed = true;
                            tool.label = newTool.label;
                            tool.index = newTool.index;
                        }
                        break;
                    }
                }
            }

            if (changed) {
                this.tools = this._sortTools(this.tools);
            }
        }
    }

    private _recalculateBots(sim: BotManager) {
        const configBot = sim.helper.userBot;
        const dimensions = calculateDimensions(
            configBot,
            EDITOR_CODE_TOOL_PORTAL
        );

        if (dimensions.length > 0) {
            const tools = [] as CodeTool[];
            for (let bot of sim.helper.objects) {
                for (let dimension of dimensions) {
                    const tool = calculateTool(bot, dimension, sim);
                    if (tool) {
                        tools.push(tool);
                        break;
                    }
                }
            }

            this.tools = this._sortTools(tools);
        } else {
            this.tools = [];
        }
    }

    private _sortTools(tools: CodeTool[]) {
        return sortBy(
            tools,
            (t) => t.index,
            (t) => t.botId
        );
    }
}

function calculateTool(bot: Bot, dimension: string, sim: BotManager): CodeTool {
    if (isBotInDimension(null, bot, dimension)) {
        const label = calculateFormattedBotValue(null, bot, 'label') ?? '';
        const index = getBotIndex(null, bot, dimension);
        return {
            botId: bot.id,
            dimension,
            simId: sim.id,
            label,
            index,
        };
    }
    return null;
}
