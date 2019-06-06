import { Transpiler, anyArgument } from './Transpiler';

describe('Transpiler', () => {
    describe('transpile()', () => {
        const cases = [
            [
                'should convert @tag to _listObjectsWithTag(tag)',
                '@tag',
                '_listObjectsWithTag("tag");',
            ],
            [
                'should convert @tag.nested to _listTagValues(tag.nested)',
                '@tag.nested',
                '_listObjectsWithTag("tag.nested");',
            ],
            [
                'should convert #tag to _listTagValues(tag)',
                '#tag',
                '_listTagValues("tag");',
            ],
        ];
        it.each(cases)('%s', (description, code, expected) => {
            const transpiler = new Transpiler();
            const result = transpiler.transpile(code);
            expect(result.trim()).toBe(expected);
        });
    });
});
