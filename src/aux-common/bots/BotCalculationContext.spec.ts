import {
    createPrecalculatedBot,
    createPrecalculatedContext,
    cacheFunction,
} from '.';

describe('BotCalculationContext', () => {
    describe('cacheFunction()', () => {
        it('should not run into conflicts when arguments are symmetrical', () => {
            const bot1 = createPrecalculatedBot('bot1');
            const bot2 = createPrecalculatedBot('bot2');

            const calc = createPrecalculatedContext([bot1, bot2]);

            const result1 = cacheFunction(
                calc,
                'test',
                () => {
                    return 'first';
                },
                'a',
                'ab'
            );

            const result2 = cacheFunction(
                calc,
                'test',
                () => {
                    return 'second';
                },
                'aa',
                'b'
            );

            expect(result1).not.toEqual(result2);
        });
    });
});
