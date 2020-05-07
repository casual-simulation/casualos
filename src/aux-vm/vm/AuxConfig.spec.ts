import { parseVersionNumber } from './AuxConfig';

describe('AuxConfig', () => {
    describe('parseVersionNumber()', () => {
        const cases = [
            ['v1.0.0', { version: 'v1.0.0', major: 1, minor: 0, patch: 0 }],
            ['v0.1.54', { version: 'v0.1.54', major: 0, minor: 1, patch: 54 }],
            ['v0.22.4', { version: 'v0.22.4', major: 0, minor: 22, patch: 4 }],
        ];

        it.each(cases)('should parse %s', (version, expected) => {
            expect(parseVersionNumber(version)).toEqual(expected);
        });

        const nullCases = [['null', null], ['a empty string', '']];

        it.each(nullCases)('should handle %s', (desc, val) => {
            expect(parseVersionNumber(val)).toEqual({
                version: null,
                major: null,
                minor: null,
                patch: null,
            });
        });
    });
});
