import { Bot } from '@casual-simulation/aux-common';

export interface ContextItem {
    bot: Bot;
    simulationId: string;
    contexts: Set<string>;
}
