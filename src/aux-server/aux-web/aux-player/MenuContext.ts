import {
    Bot,
    BotCalculationContext,
    TagUpdatedEvent,
    isBotInContext,
    getBotPosition,
    getBotIndex,
    botContextSortOrder,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import { remove, sortBy } from 'lodash';
import { getOptionalValue } from '../shared/SharedUtils';
import { PlayerSimulation3D } from './scene/PlayerSimulation3D';
import { Subject, Observable } from 'rxjs';
import { ContextGroup, ContextGroupUpdate } from '../shared/scene/ContextGroup';
import { AuxBotVisualizer } from '../shared/scene/AuxBotVisualizer';
import { ContextGroupHelper } from '../shared/scene/ContextGroupHelper';
import { MenuContextItem } from './MenuContextItem';

/**
 * MenuContext is a helper class to assist with managing the user's menu context.
 */
export class MenuContext implements ContextGroup {
    bot: Bot;
    contexts: Set<string>;

    /**
     * The simulation that the context is for.
     */
    simulation: PlayerSimulation3D;

    /**
     * The context that this object represents.
     */
    context: string = null;

    private _helper: ContextGroupHelper<MenuContextItem>;

    constructor(simulation: PlayerSimulation3D, context: string, bot: Bot) {
        if (context == null || context == undefined) {
            throw new Error('Menu context cannot be null or undefined.');
        }

        this._helper = new ContextGroupHelper(bot, (calc, bot) => {
            const context = calculateStringTagValue(
                calc,
                bot,
                'aux._userMenuContext',
                null
            );
            if (context) {
                return [context];
            } else {
                return [];
            }
        });
        this.simulation = simulation;
        this.context = context;
    }

    getBots(): AuxBotVisualizer[] {
        return this._helper.getBots();
    }

    hasBotInContext(context: string, id: string): boolean {
        return this._helper.hasBotInContext(context, id);
    }

    getBotInContext(context: string, id: string): AuxBotVisualizer {
        return this._helper.getBotInContext(context, id);
    }

    addBotToContext(context: string, bot: Bot): AuxBotVisualizer {
        const mesh = new MenuContextItem(bot);
        return this._helper.addBotToContext(context, bot, mesh);
    }

    removeBotFromContext(context: string, bot: AuxBotVisualizer): void {
        return this._helper.removeBotFromContext(context, bot);
    }

    botUpdated(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ): ContextGroupUpdate {
        return this._helper.botUpdated(bot, tags, calc);
    }

    botAdded(bot: Bot, calc: BotCalculationContext): ContextGroupUpdate {
        return this._helper.botAdded(bot, calc);
    }

    dispose(): void {}

    // private _resortItems(calc: BotCalculationContext): void {
    //     this.items = sortBy(this.bots, f =>
    //         botContextSortOrder(calc, f, this.context)
    //     ).map(f => {
    //         return {
    //             bot: f,
    //             simulationId: this.simulation
    //                 ? this.simulation.simulation.id
    //                 : null,
    //             context: this.context,
    //         };
    //     });

    //     this._itemsUpdated.next();
    // }
}
