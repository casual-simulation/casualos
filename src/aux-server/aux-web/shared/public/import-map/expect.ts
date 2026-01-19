import expect, { iterableEquality } from '@casual-simulation/expect';
import type { Tester } from '../../../../../expect';
import type { Bot } from '@casual-simulation/aux-common';
import { GET_TAG_MASKS_SYMBOL, isRuntimeBot } from '@casual-simulation/aux-common';
import { cloneDeep } from 'es-toolkit';

const botsEquality: Tester = function (first: unknown, second: unknown) {
    if (isRuntimeBot(first) && isRuntimeBot(second)) {
        expect(getBotSnapshot(first)).toEqual(getBotSnapshot(second));
        return true;
    }
    return undefined;
};

expect.extend({
    toEqual(received: unknown, expected: unknown) {
        // Copied from https://github.com/facebook/jest/blob/7bb400c373a6f90ba956dd25fe24ee4d4788f41e/packages/expect/src/matchers.ts#L580
        // Added the testBots matcher to make testing against bots easier.
        const matcherName = 'toEqual';
        const options = {
            comment: 'deep equality',
            isNot: this.isNot,
            promise: this.promise,
        };

        const pass = this.equals(received, expected, [
            botsEquality,
            iterableEquality,
        ]);

        const message = pass
            ? () =>
                  this.utils.matcherHint(
                      matcherName,
                      undefined,
                      undefined,
                      options
                  ) +
                  '\n\n' +
                  `Expected: not ${this.utils.printExpected(expected)}\n` +
                  (this.utils.stringify(expected) !==
                  this.utils.stringify(received)
                      ? `Received:     ${this.utils.printReceived(received)}`
                      : '')
            : () =>
                  this.utils.matcherHint(
                      matcherName,
                      undefined,
                      undefined,
                      options
                  ) +
                  '\n\n' +
                  this.utils.printDiffOrStringify(
                      expected,
                      received,
                      'Expected',
                      'Received',
                      this.expand !== false
                  );

        // Passing the actual and expected objects so that a custom reporter
        // could access them, for example in order to display a custom visual diff,
        // or create a different error message
        return { actual: received, expected, message, name: matcherName, pass };
    },
});

function getBotSnapshot(bot: Bot) {
    let b = {
        id: bot.id,
        space: bot.space,
        tags:
            typeof bot.tags.toJSON === 'function'
                ? bot.tags.toJSON()
                : bot.tags,
    } as Bot;

    let masks = isRuntimeBot(bot)
        ? bot[GET_TAG_MASKS_SYMBOL]()
        : cloneDeep(bot.masks ?? {});
    if (Object.keys(masks).length > 0) {
        b.masks = masks;
    }
    return b;
}

export * from '@casual-simulation/expect';
export default expect;

// Export the URL for the import map
export const url = import.meta.url;