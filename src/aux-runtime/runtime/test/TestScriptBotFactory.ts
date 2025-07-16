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
import type {
    PrecalculatedBot,
    BotTags,
    BotSpace,
    Bot,
    BotSignatures,
    RuntimeBot,
} from '@casual-simulation/aux-common/bots';
import {
    TAG_MASK_SPACE_PRIORITIES,
    hasValue,
} from '@casual-simulation/aux-common/bots';
import type { RuntimeBotInterface, RuntimeBotFactory } from '../RuntimeBot';
import { createRuntimeBot, RealtimeEditMode } from '../RuntimeBot';
import type { CompiledBot } from '../CompiledBot';
import { createCompiledBot } from '../CompiledBot';
import { pickBy } from 'lodash';
import { applyTagEdit, isTagEdit } from '@casual-simulation/aux-common/bots';
import type { RuntimeActions } from '../RuntimeEvents';

export class TestScriptBotFactory implements RuntimeBotFactory {
    createRuntimeBot(bot: Bot): RuntimeBot {
        return createDummyRuntimeBot(bot.id, bot.tags, bot.space);
    }

    destroyScriptBot() {
        return RealtimeEditMode.Immediate;
    }
}

/**
 * Creates a dummy script bot.
 * That is, a bot which uses the given values directly and does not marshall changes back to a runtime.
 * @param id The ID of the bot.
 * @param tags The tags the bot should have.
 * @param space The space of the bot.
 */
export function createDummyRuntimeBot(
    id: string,
    tags: BotTags = {},
    space?: BotSpace,
    signatures?: BotSignatures
): RuntimeBot {
    let functions = pickBy(tags, (t: any) => typeof t === 'function');
    const precalc = createCompiledBot(
        id,
        tags,
        undefined,
        space,
        functions,
        signatures
    );
    return createRuntimeBot(precalc, testScriptBotInterface);
}

export const testScriptBotInterface: RuntimeBotInterface = {
    updateTag(bot: PrecalculatedBot, tag: string, newValue: any) {
        if (isTagEdit(newValue)) {
            bot.values[tag] = bot.tags[tag] = applyTagEdit(
                bot.tags[tag],
                newValue
            );
        } else {
            if (hasValue(newValue)) {
                bot.tags[tag] = newValue;
                bot.values[tag] = newValue;
            } else {
                delete bot.tags[tag];
                delete bot.values[tag];
            }
        }
        return {
            mode: RealtimeEditMode.Immediate,
            changedValue: newValue,
        };
    },
    getValue(bot: PrecalculatedBot, tag: string) {
        return bot.values[tag];
    },
    getRawValue(bot: PrecalculatedBot, tag: string) {
        return bot.tags[tag];
    },
    getListener(bot: CompiledBot, tag: string) {
        return bot.listeners[tag];
    },
    getSignature(bot: PrecalculatedBot, signature: string): string {
        if (bot.signatures) {
            return bot.signatures[signature];
        } else {
            return undefined;
        }
    },
    notifyChange() {},
    notifyActionEnqueued(action: RuntimeActions) {},
    getTagMask(bot: CompiledBot, tag: string): any {
        if (!bot.masks) {
            return undefined;
        }
        for (let space of TAG_MASK_SPACE_PRIORITIES) {
            if (!bot.masks[space]) {
                continue;
            }
            if (tag in bot.masks[space]) {
                return bot.masks[space][tag];
            }
        }
        return undefined;
    },
    updateTagMask(bot: CompiledBot, tag: string, spaces: string[], value: any) {
        if (!bot.masks) {
            bot.masks = {};
        }
        for (let space of spaces) {
            if (!bot.masks[space]) {
                bot.masks[space] = {};
            }
            if (isTagEdit(value)) {
                bot.masks[space][tag] = applyTagEdit(
                    bot.masks[space][tag],
                    value
                );
            } else {
                bot.masks[space][tag] = value;
            }
        }
        return {
            mode: RealtimeEditMode.Immediate,
            changedValue: value,
        };
    },
    getTagLink(bot: CompiledBot, tag: string) {
        return null;
    },
    addDynamicListener(bot, tag, listener) {
        if (!bot.dynamicListeners) {
            bot.dynamicListeners = {};
        }
        if (!bot.dynamicListeners[tag]) {
            bot.dynamicListeners[tag] = [];
        }
        bot.dynamicListeners[tag].push(listener);
    },
    removeDynamicListener(bot, tag, listener) {
        if (bot.dynamicListeners && bot.dynamicListeners[tag]) {
            const listeners = bot.dynamicListeners[tag];
            const index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
                if (listeners.length <= 0) {
                    delete bot.dynamicListeners[tag];
                }
            }
        }
    },
    getDynamicListeners(bot, tag) {
        if (bot.dynamicListeners && bot.dynamicListeners[tag]) {
            return bot.dynamicListeners[tag];
        }
        return null;
    },

    currentVersion: {
        localSites: {},
        vector: {},
    },
};
