import { escapeRegex } from './MongoDBRepoStore';

describe('MongoDBRepoStore', () => {
    describe('escapeRegex()', () => {
        const cases = [
            ['^', '\\^'],
            ['$', '\\$'],
            ['.', '\\.'],
            ['*', '\\*'],
            ['+', '\\+'],
            ['?', '\\?'],
            ['(', '\\('],
            [')', '\\)'],
            ['[', '\\['],
            [']', '\\]'],
            ['{', '\\{'],
            ['}', '\\}'],
            ['\\', '\\\\'],
            ['|', '\\|'],
            ['abc?d+', 'abc\\?d\\+'],
        ];

        it.each(cases)('should escape %s', (val, expected) => {
            expect(escapeRegex(val)).toBe(expected);
        });
    });
});
