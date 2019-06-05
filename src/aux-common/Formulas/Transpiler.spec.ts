import { Transpiler } from './Transpiler';

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

    describe('dependencies()', () => {
        const cases = [
            ['@ expressions', 'file', '@'],
            ['# expressions', 'tag', '#'],
        ];

        describe.each(cases)('%s', (desc, type, symbol) => {
            it(`should return the tags`, () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag().num + ${symbol}other().num`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: [],
                        members: ['num'],
                    },
                    {
                        type: type,
                        name: 'other',
                        args: [],
                        members: ['num'],
                    },
                ]);
            });

            it('should support dots in tag names', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag.test().num`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag.test',
                        args: [],
                        members: ['num'],
                    },
                ]);
            });

            it('should contain the simple arguments used in the expression', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag("hello, world", 123)`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: ['"hello, world"', '123'],
                        members: [],
                    },
                ]);
            });

            it('should contain the complex arguments used in the expression', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag(x => x.indexOf("hi") >= 0)`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: ['x => x.indexOf("hi") >= 0'],
                        members: [],
                    },
                ]);
            });

            it('should parse the tags after the expression', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag().aux.color`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: [],
                        members: ['aux', 'color'],
                    },
                ]);
            });

            it('should support indexers after the expression', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `${symbol}tag()['funny']`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: [],
                        members: ['funny'],
                    },
                ]);
            });

            it('should support convert variables in indexers to wildcards', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(`${symbol}tag()[myVar]`);

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: [],
                        members: ['*'],
                    },
                ]);
            });

            it('should handle members in other function calls', () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `math.sum(${symbol}tag().length)`
                );

                expect(result.tags).toEqual([
                    {
                        type: type,
                        name: 'tag',
                        args: [],
                        members: ['length'],
                    },
                ]);
            });
        });

        describe('this', () => {
            it(`should return dependencies on this`, () => {
                const transpiler = new Transpiler();

                const result = transpiler.dependencies(
                    `this.num + this.index * this.something.else - this[other][thing]`
                );

                expect(result.tags).toEqual([
                    {
                        type: 'this',
                        members: ['num'],
                    },
                    {
                        type: 'this',
                        members: ['index'],
                    },
                    {
                        type: 'this',
                        members: ['something', 'else'],
                    },
                    {
                        type: 'this',
                        members: ['*', '*'],
                    },
                ]);
            });
        });
    });
});
