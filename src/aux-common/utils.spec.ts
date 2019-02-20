import { merge } from "./utils";

describe('utils', () => {
    describe('merge()', () => {
        it('should take keys from both objects and return a new object', () => {
            const first = {
                abc: 'def'
            };
            const second = {
                def: 'abc'
            };

            const final = merge(first, second);

            expect(final).toEqual({
                abc: 'def',
                def: 'abc'
            });
        });

        it('should not change objects that are the same in both', () => {
            const inner = {
                test: 'abc'
            };
            const first = {
                inner: inner,
                abc: 'def'
            };
            const second = {
                inner: inner,
                def: 'abc'
            };

            const final = merge(first, second);

            expect(final.inner).toBe(inner);
            expect(final).toEqual({
                inner: inner,
                abc: 'def',
                def: 'abc'
            });
        });

        it('should take the latest value', () => {
            const first = {
                abc: 'def'
            };
            const second = {
                abc: 'abc'
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
                other: 'cool'
            };
            const second = {
                isUndefined: <any>undefined,
                value: <number>null,
                other: <number>undefined
            };

            const final = merge(first, second);

            expect(final).toEqual({
                isNull: null,
                isUndefined: undefined,
                value: null,
                other: 'cool'
            });
        });
    });
});