import {
    Dependencies,
    AuxScriptMemberDependency,
    AuxScriptExpressionDependencies,
} from './Dependencies';

describe('Dependencies', () => {
    let dependencies: Dependencies;
    beforeEach(() => {
        dependencies = new Dependencies();
    });

    describe('dependencyTree()', () => {
        const cases = [
            ['@ expressions', 'file', '@'],
            ['# expressions', 'tag', '#'],
        ];

        describe.each(cases)('%s', (desc, type, symbol) => {
            it(`should return the tags`, () => {
                const result = dependencies.dependencyTree(
                    `${symbol}tag().num + ${symbol}other().num`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: type,
                                name: 'tag',
                                dependencies: [],
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: type,
                                name: 'other',
                                dependencies: [],
                            },
                        },
                    ],
                });
            });

            it('should support dots in tag names', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}tag.test().num`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: type,
                                name: 'tag.test',
                                dependencies: [],
                            },
                        },
                    ],
                });
            });

            it('should contain the simple arguments used in the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}tag("hello, world", 123)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            name: 'tag',
                            dependencies: [],
                        },
                    ],
                });
            });

            it('should contain the complex arguments used in the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}tag(x => x.indexOf("hi") >= 0)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            name: 'tag',
                            dependencies: [
                                {
                                    type: 'expression',
                                    dependencies: [
                                        {
                                            type: 'call',
                                            identifier: {
                                                type: 'member',
                                                identifier: 'indexOf',
                                                object: {
                                                    type: 'member',
                                                    identifier: 'x',
                                                    object: null,
                                                },
                                            },
                                            dependencies: [],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should parse the tags after the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}tag().aux.color`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'color',
                            object: {
                                type: 'member',
                                identifier: 'aux',
                                object: {
                                    type: type,
                                    name: 'tag',
                                    dependencies: [],
                                },
                            },
                        },
                    ],
                });
            });

            it('should support indexers after the expression', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}tag()['funny']`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'funny',
                            object: {
                                type: type,
                                name: 'tag',
                                dependencies: [],
                            },
                        },
                    ],
                });
            });

            it('should fail on expressions that use variables in indexer expressions', () => {
                expect(() => {
                    const result = dependencies.dependencyTree(
                        `${symbol}tag()[myVar]`
                    );
                }).toThrow();
            });

            it('should handle members in other function calls', () => {
                const result = dependencies.dependencyTree(
                    `math.sum(${symbol}tag().length)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'sum',
                                object: {
                                    type: 'member',
                                    identifier: 'math',
                                    object: null,
                                },
                            },
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'length',
                                    object: {
                                        type: type,
                                        name: 'tag',
                                        dependencies: [],
                                    },
                                },
                            ],
                        },
                    ],
                });
            });

            it('should include dependencies in filters', () => {
                const result = dependencies.dependencyTree(
                    `${symbol}tag(x => x == this.val)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            name: 'tag',
                            dependencies: [
                                {
                                    type: 'expression',
                                    dependencies: [
                                        {
                                            type: 'member',
                                            identifier: 'val',
                                            object: {
                                                type: 'member',
                                                identifier: 'this',
                                                object: null,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });
        });

        describe('this', () => {
            it(`should return dependencies on this`, () => {
                const result = dependencies.dependencyTree(
                    `this.num + this.index * this.something.else - this['other']['thing']`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'num',
                            object: {
                                type: 'member',
                                identifier: 'this',
                                object: null,
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'index',
                            object: {
                                type: 'member',
                                identifier: 'this',
                                object: null,
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'else',
                            object: {
                                type: 'member',
                                identifier: 'something',
                                object: {
                                    type: 'member',
                                    identifier: 'this',
                                    object: null,
                                },
                            },
                        },
                        {
                            type: 'member',
                            identifier: 'thing',
                            object: {
                                type: 'member',
                                identifier: 'other',
                                object: {
                                    type: 'member',
                                    identifier: 'this',
                                    object: null,
                                },
                            },
                        },
                    ],
                });
            });

            it(`should handle just the keyword without members`, () => {
                const result = dependencies.dependencyTree(`this`);

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'this',
                            object: null,
                        },
                    ],
                });
            });
        });

        describe('functions', () => {
            it(`should return dependencies for functions`, () => {
                const result = dependencies.dependencyTree(
                    `getFilesInContext("wow")`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'getFilesInContext',
                                object: null,
                            },
                            dependencies: [],
                        },
                    ],
                });
            });

            it(`should handle nested dependencies`, () => {
                const result = dependencies.dependencyTree(
                    `getFilesInContext(this.abc)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'getFilesInContext',
                                object: null,
                            },
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'abc',
                                    object: {
                                        type: 'member',
                                        identifier: 'this',
                                        object: null,
                                    },
                                },
                            ],
                        },
                    ],
                });
            });

            it(`should properly handle namespaces`, () => {
                const result = dependencies.dependencyTree(
                    `player.toast(this.abc)`
                );

                expect(result).toEqual({
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'call',
                            identifier: {
                                type: 'member',
                                identifier: 'toast',
                                object: {
                                    type: 'member',
                                    identifier: 'player',
                                    object: null,
                                },
                            },
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'abc',
                                    object: {
                                        type: 'member',
                                        identifier: 'this',
                                        object: null,
                                    },
                                },
                            ],
                        },
                    ],
                });
            });
        });
    });

    describe('dependentTagsAndFunctions()', () => {
        it('should return the list of tags that an expression is dependent on', () => {
            const result = dependencies.dependentTagsAndFunctions(<
                AuxScriptExpressionDependencies
            >{
                type: 'expression',
                dependencies: [
                    {
                        type: 'file',
                        name: 'abc.def',
                        dependencies: [
                            {
                                type: 'tag',
                                name: 'test',
                            },
                        ],
                    },
                    {
                        type: 'tag',
                        name: 'ghi',
                        dependencies: [],
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'file',
                    name: 'abc.def',
                },
                {
                    type: 'tag',
                    name: 'test',
                },
                {
                    type: 'tag',
                    name: 'ghi',
                },
            ]);
        });

        it('should include functions that the tree is dependent on', () => {
            const result = dependencies.dependentTagsAndFunctions(<
                AuxScriptExpressionDependencies
            >{
                type: 'expression',
                dependencies: [
                    {
                        type: 'call',
                        identifier: {
                            type: 'member',
                            identifier: 'abc',
                            object: {
                                type: 'member',
                                identifier: 'test',
                                object: null,
                            },
                        },
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'function',
                    name: 'test.abc',
                },
            ]);
        });

        it('should include members that the tree is dependent on', () => {
            const result = dependencies.dependentTagsAndFunctions(<
                AuxScriptExpressionDependencies
            >{
                type: 'expression',
                dependencies: [
                    {
                        type: 'member',
                        identifier: 'abc',
                        object: {
                            type: 'member',
                            identifier: 'test',
                            object: null,
                        },
                    },
                ],
            });

            expect(result).toEqual([
                {
                    type: 'member',
                    name: 'test.abc',
                },
            ]);
        });

        const cases = [
            ['@ expressions', 'file', '@'],
            ['# expressions', 'tag', '#'],
        ];
        describe.each(cases)('%s', (desc, type, symbol) => {
            it('should ignore member nodes when they are for tag/file expressions', () => {
                const result = dependencies.dependentTagsAndFunctions(<
                    AuxScriptExpressionDependencies
                >{
                    type: 'expression',
                    dependencies: [
                        {
                            type: 'member',
                            identifier: 'abc',
                            object: {
                                type: 'member',
                                identifier: 'test',
                                object: {
                                    type: type,
                                    name: 'hello',
                                    dependencies: [],
                                },
                            },
                        },
                    ],
                });

                expect(result).toEqual([
                    {
                        type: type,
                        name: 'hello',
                    },
                ]);
            });

            it('should include dependencies', () => {
                const result = dependencies.dependentTagsAndFunctions(<
                    AuxScriptExpressionDependencies
                >{
                    type: 'expression',
                    dependencies: [
                        {
                            type: type,
                            name: 'hello',
                            dependencies: [
                                {
                                    type: 'member',
                                    identifier: 'isBuilder',
                                    object: null,
                                },
                                {
                                    type: 'call',
                                    identifier: {
                                        type: 'member',
                                        identifier: 'isBuilder',
                                        object: {
                                            type: 'member',
                                            identifier: 'player',
                                            object: null,
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                });

                expect(result).toEqual([
                    {
                        type: type,
                        name: 'hello',
                    },
                    {
                        type: 'member',
                        name: 'isBuilder',
                    },
                    {
                        type: 'function',
                        name: 'player.isBuilder',
                    },
                ]);
            });
        });
    });

    describe('getMemberName()', () => {
        it('should return the identifier', () => {
            const result = dependencies.getMemberName(<
                AuxScriptMemberDependency
            >{
                type: 'member',
                identifier: 'abc',
                object: null,
            });

            expect(result).toBe('abc');
        });

        it('should return the identifiers joined by dots', () => {
            const result = dependencies.getMemberName(<
                AuxScriptMemberDependency
            >{
                type: 'member',
                identifier: 'abc',
                object: {
                    type: 'member',
                    identifier: 'def',
                    object: null,
                },
            });

            expect(result).toBe('def.abc');
        });

        const cases = [
            ['@ expressions', 'file', '@'],
            ['# expressions', 'tag', '#'],
        ];

        describe.each(cases)('%s', (desc, type, symbol) => {
            it('should handle expressions', () => {
                const result = dependencies.getMemberName(<
                    AuxScriptMemberDependency
                >{
                    type: 'member',
                    identifier: 'abc',
                    object: {
                        type: 'member',
                        identifier: 'def',
                        object: {
                            type: type,
                            name: 'tag.abc',
                            dependencies: [],
                        },
                    },
                });

                expect(result).toBe(`${symbol}tag.abc().def.abc`);
            });
        });
    });
});
