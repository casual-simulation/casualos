import { createBot } from '../bots/BotCalculations';
import { apply } from './AuxStateHelpers';
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
    });
});
