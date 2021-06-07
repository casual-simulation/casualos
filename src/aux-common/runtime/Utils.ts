import { RealtimeEditMode } from './RuntimeBot';
import { hasValue, isBot, isRuntimeBot } from '../bots/BotCalculations';
import { AuxPartitionRealtimeStrategy } from '../partitions/AuxPartition';
import { forOwn } from 'lodash';
import { Easing, EaseMode, EaseType } from '../bots';
import TWEEN, { Easing as TweenEasing } from '@tweenjs/tween.js';

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

export function getDefaultEasing(easing: Easing | EaseType): Easing {
    return hasValue(easing)
        ? typeof easing === 'string'
            ? {
                  mode: 'inout',
                  type: easing,
              }
            : easing
        : {
              mode: 'inout',
              type: 'linear',
          };
}

export function getEasing(easing: Easing | EaseType) {
    const value = getDefaultEasing(easing);
    return getTweenEasing(value as Easing);
}

export function getTweenEasing(easing: Easing): any {
    switch (easing.type) {
        case 'linear':
        default:
            return TWEEN.Easing.Linear.None;
        case 'circular':
            return resolveEaseType(easing.mode, TWEEN.Easing.Circular);
        case 'cubic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Cubic);
        case 'exponential':
            return resolveEaseType(easing.mode, TWEEN.Easing.Exponential);
        case 'elastic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Elastic);
        case 'quadratic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quadratic);
        case 'quartic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quartic);
        case 'quintic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quintic);
        case 'sinusoidal':
            return resolveEaseType(easing.mode, TWEEN.Easing.Sinusoidal);
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
