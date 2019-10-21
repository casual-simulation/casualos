import { Bot } from '@casual-simulation/aux-common';

export interface MenuItem {
    bot: Bot;
    simulationId: string;
    contexts: Set<string>;
}
