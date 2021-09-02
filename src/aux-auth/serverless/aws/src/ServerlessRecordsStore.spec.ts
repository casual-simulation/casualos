import { escapeRedisPattern } from './ServerlessRecordsStore';

describe('escapeRedisPattern()', () => {
    const cases = [
        ['myAddress', 'myAddress'],
        ['myAddress/*', 'myAddress/\\*'],
        ['my?ddress/*', 'my\\?ddress/\\*'],
        ['\\', '\\\\'],
        ['[', '\\['],
        [']', '\\]'],
        ['-', '\\-'],
        ['^', '\\^'],
    ];

    it.each(cases)('should escape %s', (input, expected) => {
        expect(escapeRedisPattern(input)).toBe(expected);
    });
});
