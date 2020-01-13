import { Bot } from '@casual-simulation/aux-common';

export interface DimensionItem {
    bot: Bot;
    simulationId: string;
    dimensions: Set<string>;
}
