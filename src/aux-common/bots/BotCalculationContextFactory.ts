import type { Bot } from './Bot';
import type { BotCalculationContext } from './BotCalculationContext';
import { BotLookupTableHelper } from './BotLookupTableHelper';

export function createPrecalculatedContext(
    objects: Bot[]
): BotCalculationContext {
    const context = {
        objects: objects,
        cache: new Map(),
        lookup: new BotLookupTableHelper(),
    };
    return context;
}
