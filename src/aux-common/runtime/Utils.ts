import { RealtimeEditMode } from './RuntimeBot';
import { isBot, isRuntimeBot } from '../bots/BotCalculations';
import { AuxPartitionRealtimeStrategy } from '../partitions/AuxPartition';
import forOwn from 'lodash/forOwn';
import { Easing, EaseMode } from '../bots';
import { Easing as TweenEasing } from '@tweenjs/tween.js';

/**
 * Converts the given value to a copiable value.
 * Copiable values are strings, numbers, booleans, arrays, and objects made of any of those types.
 * Non-copiable values are functions and errors.
 * @param value
 */
export function convertToCopiableValue(value: any): any {
    try {
        return _convertToCopiableValue(value, 0, new Map());
    } catch (err) {
        if (err instanceof DeepObjectError) {
            return '[Nested object]';
        }
        throw err;
    }
}

function _convertToCopiableValue(
    value: any,
    depth: number,
    map: Map<any, any>
): any {
    if (depth > 1000) {
        throw new DeepObjectError();
    }
    if (typeof value === 'function') {
        return `[Function ${value.name}]`;
    } else if (value instanceof Error) {
        return `${value.name}: ${value.message}`;
    } else if (typeof value === 'object') {
        if (map.has(value)) {
            return map.get(value);
        }
        if (isRuntimeBot(value)) {
            const result = {
                id: value.id,
                tags: value.tags.toJSON(),
            };
            map.set(value, result);
            return result;
        } else if (isBot(value)) {
            const result = {
                id: value.id,
                tags: value.tags,
            };
            map.set(value, result);
            return result;
        } else if (Array.isArray(value)) {
            const result = [] as any[];
            map.set(value, result);
            result.push(
                ...value.map((val) =>
                    _convertToCopiableValue(val, depth + 1, map)
                )
            );
            return result;
        } else if (value === null || value === undefined) {
            return value;
        } else {
            let result = {} as any;
            map.set(value, result);
            forOwn(value, (val, key, object) => {
                result[key] = _convertToCopiableValue(val, depth + 1, map);
            });
            return result;
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

export class DeepObjectError extends Error {
    constructor() {
        super('Object too deeply nested.');
    }
}

export function getEasing(easing: Easing): any {
    switch (easing.type) {
        case 'linear':
        default:
            return TweenEasing.Linear.None;
        case 'circular':
            return resolveEaseType(easing.mode, TweenEasing.Circular);
        case 'cubic':
            return resolveEaseType(easing.mode, TweenEasing.Cubic);
        case 'exponential':
            return resolveEaseType(easing.mode, TweenEasing.Exponential);
        case 'elastic':
            return resolveEaseType(easing.mode, TweenEasing.Elastic);
        case 'quadratic':
            return resolveEaseType(easing.mode, TweenEasing.Quadratic);
        case 'quartic':
            return resolveEaseType(easing.mode, TweenEasing.Quartic);
        case 'quintic':
            return resolveEaseType(easing.mode, TweenEasing.Quintic);
        case 'sinusoidal':
            return resolveEaseType(easing.mode, TweenEasing.Sinusoidal);
    }
}

function resolveEaseType(
    mode: EaseMode,
    val: typeof TweenEasing.Circular | typeof TweenEasing.Linear
): any {
    if ('None' in val) {
        return val.None;
    } else {
        switch (mode) {
            case 'in':
                return val.In;
            case 'out':
                return val.Out;
            case 'inout':
            default:
                return val.InOut;
        }
    }
}
