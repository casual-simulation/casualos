/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, mergeUpdates } from 'yjs';
import type {
    Bot,
    BotsState,
    CreateInitializationUpdateAction,
    GetInstStateFromUpdatesAction,
    InstUpdate,
} from '../bots';
import {
    botAdded,
    createBot,
    formatBotDate,
    formatBotRotation,
    formatBotVector,
    hasValue,
    isBot,
    isRuntimeBot,
    ORIGINAL_OBJECT,
} from '../bots';
import { YjsPartitionImpl } from './YjsPartition';
import { DateTime } from 'luxon';
import { Rotation, Vector2, Vector3 } from '../math';
import { forOwn } from 'lodash';
import '../BlobPolyfill';
import type { PartitionRemoteEvents } from './AuxPartitionConfig';
import type { RemoteActions } from '../common';
import { RemoteAction } from '../common';

/**
 * Creates a new initialization update using the given action.
 */
export function constructInitializationUpdate(
    action: CreateInitializationUpdateAction
): InstUpdate {
    const partition = new YjsPartitionImpl({
        type: 'yjs',
    });

    let instUpdate: InstUpdate;
    partition.doc.on('update', (update: Uint8Array) => {
        instUpdate = {
            id: 0,
            timestamp: Date.now(),
            update: fromByteArray(update),
        };
    });

    partition.applyEvents(
        action.bots.map((b) => botAdded(createBot(b.id, b.tags)))
    );

    return instUpdate;
}

/**
 * Gets the bots state that is encoded from the given action.
 * @param action The action.
 */
export function getStateFromUpdates(
    action: GetInstStateFromUpdatesAction
): BotsState {
    let partition = new YjsPartitionImpl({
        type: 'yjs',
    });

    for (let { update } of action.updates) {
        const updateBytes = toByteArray(update);
        applyUpdate(partition.doc, updateBytes);
    }

    return partition.state;
}

/**
 * Merges the given inst updates into a single update.
 * @param updates The list of updates to merge.
 */
export function mergeInstUpdates(
    updates: InstUpdate[],
    id: number = updates.length,
    timestamp: number = Date.now()
): InstUpdate {
    const update = mergeUpdates(updates.map((u) => toByteArray(u.update)));
    return {
        id,
        timestamp,
        update: fromByteArray(update),
    };
}

/**
 * Converts the given error to a copiable value.
 * Returns a new value that can be sent over to web workers.
 * @param err The error to convert.
 */
export function convertErrorToCopiableValue(err: unknown): any {
    if (err instanceof Error) {
        let obj: any = {
            message: err.message,
            name: err.name,
            stack: err.stack,
        };

        if ((<any>err).response) {
            let response = (<any>err).response;
            obj.response = {
                data: response.data,
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
            };
        }

        return obj;
    } else {
        return err;
    }
}

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
            } as Bot;
            if (hasValue(value.space)) {
                result.space = value.space;
            }
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
        } else if (value instanceof Date) {
            return value;
        } else if (value instanceof Blob) {
            return value;
        } else if (value instanceof ArrayBuffer) {
            return value;
        } else if (ArrayBuffer.isView(value)) {
            return value;
        } else if (value instanceof DateTime) {
            return formatBotDate(value);
        } else if (value instanceof Vector2 || value instanceof Vector3) {
            return formatBotVector(value);
        } else if (value instanceof Rotation) {
            return formatBotRotation(value);
        } else if (ORIGINAL_OBJECT in value) {
            const val = value[ORIGINAL_OBJECT];
            map.set(value, val);
            return val;
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

/**
 * Deeply traverses over all the keys in the given value and calls the given action for each stored value.
 * To prevent infinite loops, the traversal will stop if the depth exceeds 1000.
 *
 * @param value The value to traverse.
 * @param action The action to perform for each value. If the action returns false, then the traversal will stop.
 * @param depth The depth of the traversal.
 */
function deepTraverse(
    value: any,
    action: (val: any) => void | boolean,
    depth: number = 0
) {
    if (depth > 1000) {
        throw new DeepObjectError();
    }
    if (hasValue(value) && typeof value === 'object') {
        if (Array.isArray(value)) {
            for (let val of value) {
                if (action(val) === false) {
                    return;
                }
                deepTraverse(val, action, depth + 1);
            }
        } else {
            for (let key in value) {
                const val = (value as Record<string, any>)[key];
                if (action(val) === false) {
                    return;
                }
                deepTraverse(val, action, depth + 1);
            }
        }
    }
}

export class DeepObjectError extends Error {
    constructor() {
        super('Object too deeply nested.');
    }
}

/**
 * Checks each of the tags in the given bot to ensure that the bot is copiable and returns a new bot with serializable values if the given bot is contains non-serializable values.
 * @param bot The bot to check.
 */
export function ensureBotIsSerializable(bot: Bot): Bot {
    let newBot: Bot;
    for (let tag in bot.tags) {
        const value = bot.tags[tag];
        if (
            value instanceof DateTime ||
            value instanceof Vector2 ||
            value instanceof Vector3 ||
            value instanceof Rotation
        ) {
            updateTag(tag, convertToCopiableValue(value));
        } else if (hasValue(value) && typeof value === 'object') {
            if (ORIGINAL_OBJECT in value) {
                updateTag(tag, value[ORIGINAL_OBJECT]);
            } else {
                deepTraverse(value, (val) => {
                    if (
                        hasValue(val) &&
                        typeof val === 'object' &&
                        ORIGINAL_OBJECT in val
                    ) {
                        updateTag(tag, convertToCopiableValue(value));
                        return false;
                    }
                });
            }
        }
    }

    return newBot ?? bot;

    function updateTag(tag: string, value: any) {
        if (!newBot) {
            newBot = createBot(bot.id, { ...bot.tags }, bot.space);
        }
        newBot.tags[tag] = value;
    }
}

/**
 * Checks that the given tag is copiable and returns the copiable version of the value if it is not.
 * @param value The value to check.
 */
export function ensureTagIsSerializable(value: any): any {
    if (
        value instanceof DateTime ||
        value instanceof Vector2 ||
        value instanceof Vector3 ||
        value instanceof Rotation
    ) {
        return convertToCopiableValue(value);
    } else if (
        hasValue(value) &&
        typeof value === 'object' &&
        ORIGINAL_OBJECT in value
    ) {
        return value[ORIGINAL_OBJECT];
    }

    return value;
}

/**
 * Determines if the given config supports the given remote action.
 * @param config The config. If this is true, then it will be treated as if every remote event is supported.
 * @param action The action to test.
 */
export function supportsRemoteEvent(
    config: PartitionRemoteEvents | boolean,
    action: RemoteActions
): boolean {
    if (config === true) {
        return true;
    } else if (config === false) {
        return false;
    } else if (action.type === 'remote' && action.event.type in config) {
        return config[action.event.type] ?? false;
    }
    return config.remoteActions ?? false;
}
