import { createBot } from '../bots/BotCalculations';
import { apply, updates } from './AuxStateHelpers';
import { Bot } from '../bots/Bot';

describe('AuxStateHelpers', () => {
    describe('apply()', () => {
        describe('new bots', () => {
            it('should add new bots to the state', () => {
                const current = {};
                const update = {
                    test: createBot('test'),
                };

                const final = apply(current, update);
                expect(final).toEqual(update);
            });
        });

        describe('updated tags', () => {
            it('should merge tags', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                    }),
                };
                const update = {
                    test: createBot('test', {
                        def: 'ghi',
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                            def: 'ghi',
                        },
                    },
                });
            });

            it('should overwrite tags', () => {
                const current = {
                    test: createBot('test', {
                        abc: [1, 2, 3],
                    }),
                };
                const update = {
                    test: createBot('test', {
                        abc: 'haha',
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: createBot('test', {
                        abc: 'haha',
                    }),
                });
            });

            it('should not merge arrays', () => {
                const current = {
                    test: createBot('test', {
                        abc: [1, 2, 3],
                    }),
                };
                const update = {
                    test: createBot('test', {
                        abc: [3, 2, 1],
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: createBot('test', {
                        abc: [3, 2, 1],
                    }),
                });
            });
        });

        describe('deleted bots', () => {
            it('should delete bots that are set to null', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                    }),
                };
                const update = {
                    test: null as Bot,
                };

                const final = apply(current, update);
                expect(final).toEqual({});
            });
        });

        describe('deleted tags', () => {
            it('should delete tags that are set to null', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            abc: null as string,
                        },
                    },
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: createBot('test'),
                });
            });
        });

        describe('deleted signatures', () => {
            it('should delete signatures that are set to null', () => {
                const current = {
                    test: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                        signatures: {
                            sig: 'abc',
                        },
                    },
                };
                const update = {
                    test: {
                        signatures: {
                            sig: null as string,
                        },
                    },
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });
        });
    });

    describe('updates()', () => {
        describe('new bots', () => {
            it('should return the new bots', () => {
                const current = {};
                const update = {
                    test: createBot('test'),
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [createBot('test')],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should discard partial bots that are new', () => {
                const current = {};
                const update = {
                    test: {
                        tags: {
                            abc: 'def',
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });

        describe('removed bots', () => {
            it('should remove bots set to null in the update', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: null as Bot,
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: ['test'],
                    updatedBots: [],
                });
            });
        });

        describe('updated bots', () => {
            it('should record new tags', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: {
                        tags: {
                            abc: 'def',
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'def',
                            }),
                            tags: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should record new signatures', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: {
                        signatures: {
                            abc: 'tag',
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: {
                                id: 'test',
                                tags: {},
                                signatures: {
                                    abc: 'tag',
                                },
                            },
                            tags: new Set(),
                            signatures: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should record updated tags', () => {
                const current = {
                    test: createBot('test', {
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            num: 123,
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                num: 123,
                            }),
                            tags: new Set(['num']),
                        },
                    ],
                });
            });

            it('should ignore tags that were not updated', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            num: 123,
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'def',
                                num: 123,
                            }),
                            tags: new Set(['num']),
                        },
                    ],
                });
            });

            it('should delete tags that were set to null', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            num: null as any,
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'def',
                            }),
                            tags: new Set(['num']),
                        },
                    ],
                });
            });

            it('should not include the update if no tags were updated', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {},
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });
    });
});
