import mapValues from 'lodash/mapValues';
import { isRuntimeBot, RealtimeEditMode } from './RuntimeBot';
import { isBot } from '../bots/BotCalculations';
import { AuxPartitionRealtimeStrategy } from '../partitions/AuxPartition';

/**
 * Converts the given value to a copiable value.
 * Copiable values are strings, numbers, booleans, arrays, and objects made of any of those types.
 * Non-copiable values are functions and errors.
 * @param value
 */
export function convertToCopiableValue(value: any): any {
    if (typeof value === 'function') {
        return `[Function ${value.name}]`;
    } else if (value instanceof Error) {
        return `${value.name}: ${value.message}`;
    } else if (typeof value === 'object') {
        if (isRuntimeBot(value)) {
            return {
                id: value.id,
                tags: value.tags.toJSON(),
            };
        } else if (isBot(value)) {
            return {
                id: value.id,
                tags: value.tags,
            };
        } else if (Array.isArray(value)) {
            return value.map(val => convertToCopiableValue(val));
        } else if (value === null || value === undefined) {
            return value;
        } else {
            return mapValues(value, val => convertToCopiableValue(val));
        }
    }
    return value;
}

export function realtimeStrategyToRealtimeEditMode(
    strategy: AuxPartitionRealtimeStrategy
): RealtimeEditMode {
    return strategy === 'immediate'
        ? RealtimeEditMode.Immediate
        : RealtimeEditMode.Delayed;
}
