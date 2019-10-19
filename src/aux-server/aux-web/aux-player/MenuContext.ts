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

/**
 * MenuContext is a helper class to assist with managing the user's menu context.
 */
export class MenuContext {
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

    constructor(simulation: PlayerSimulation3D, context: string, bot: Bot) {
        if (context == null || context == undefined) {
            throw new Error('Menu context cannot be null or undefined.');
        }

        this.simulation = simulation;
        this.context = context;
    }
}
