import { AuxBotVisualizer } from '../shared/scene/AuxBotVisualizer';
import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';

export class MenuContextItem implements AuxBotVisualizer {
    constructor(bot: Bot) {
        this.bot = bot;
    }

    bot: Bot;

    botUpdated(bot: Bot, tags: string[], calc: BotCalculationContext): void {
        bot = bot;
    }

    frameUpdate(calc: BotCalculationContext): void {}
    dispose(): void {}
}
