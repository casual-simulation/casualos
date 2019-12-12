import { merge, parseRealtimeChannelId, dotCaseToCamelCase } from './utils';

describe('utils', () => {
    describe('merge()', () => {
        it('should take keys from both objects and return a new object', () => {
            const first = {
                abc: 'def',
            };
            const second = {
                def: 'abc',
            };

            const final = merge(first, second);

            expect(final).toEqual({
                abc: 'def',
                def: 'abc',
            });
        });

        it('should not change objects that are the same in both', () => {
            const inner = {
                test: 'abc',
            };
            const first = {
                inner: inner,
                abc: 'def',
            };
            const second = {
                inner: inner,
                def: 'abc',
            };

            const final = merge(first, second);

            expect(final.inner).toBe(inner);
            expect(final).toEqual({
                inner: inner,
                abc: 'def',
                def: 'abc',
            });
        });

        it('should take the latest value', () => {
            const first = {
                abc: 'def',
            };
            const second = {
                abc: 'abc',
            };

            const final = merge(first, second);

            expect(final).toEqual({
                abc: 'abc',
            });
        });

        it('should preserve nulls but not undefined', () => {
            const first = {
                isNull: <any>null,
                value: 10,
                other: 'cool',
            };
            const second = {
                isUndefined: <any>undefined,
                value: <number>null,
                other: <number>undefined,
            };

            const final = merge(first, second);

            expect(final).toEqual({
                isNull: null,
                isUndefined: undefined,
                value: null,
                other: 'cool',
            });
        });
    });

    describe('parseRealtimeChannelId()', () => {
        const cases = [['aux-test', 'test']];

        it.each(cases)('should convert %s to %s', (given, expected) => {
            expect(parseRealtimeChannelId(given)).toBe(expected);
        });
    });

    describe('dotCaseToCamelCase()', () => {
        const cases = [
            ['', ''],
            ['noChange', 'noChange'],
            ['1.2.3', '123'],
            ['dot.case', 'dotCase'],
            ['dot1.case2', 'dot1Case2'],
            ['dot1.2case', 'dot12case'],
            ['TITLE.CASE', 'TITLECASE'],
            ['dot._case', '_dotCase'],
            ['_dot._case', '_dotCase'],
        ];

        it.each(cases)('should convert %s to %s', (given, expected) => {
            expect(dotCaseToCamelCase(given)).toBe(expected);
        });
    });
});
