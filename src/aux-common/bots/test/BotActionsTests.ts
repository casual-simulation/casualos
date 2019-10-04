import {
    action,
    botAdded,
    botRemoved,
    botUpdated,
    superShout,
    toast,
    tweenTo,
    openQRCodeScanner,
    showQRCode,
    loadSimulation,
    unloadSimulation,
    importAUX,
    showInputForTag,
    goToContext,
    goToURL,
    openURL,
    sayHello,
    grantRole,
    revokeRole,
    shell,
    openConsole,
    echo,
    backupToGithub,
    backupAsDownload,
    openBarcodeScanner,
    showBarcode,
    checkout,
    finishCheckout,
    webhook,
} from '../BotEvents';
import {
    COMBINE_ACTION_NAME,
    createBot,
    getActiveObjects,
} from '../BotCalculations';
import { getBotsForAction } from '../BotsChannel';
import {
    calculateActionEvents,
    calculateActionResults,
    calculateDestroyBotEvents,
    calculateFormulaEvents,
} from '../BotActions';
import { BotsState } from '../Bot';
import { createCalculationContext } from '../BotCalculationContextFactories';
import { SandboxFactory } from '../../Formulas/Sandbox';
import { remote } from '@casual-simulation/causal-trees';

export function botActionsTests(
    uuidMock: jest.Mock,
    createSandbox?: SandboxFactory
) {
    describe('calculateActionEvents()', () => {
        it('should run scripts on the this bot and return the resulting actions', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'test()': 'create(null, this);',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'test()': 'create(null, this);',

                        // the new bot is not destroyed
                    },
                }),
            ]);
        });

        it('should preserve formulas when copying', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        'test()':
                            'create(null, this, that, { testFormula: "=this.name" });',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        name: 'Friend',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action(
                'test',
                ['thisBot'],
                undefined,
                state['thatBot']
            );
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        'test()':
                            'create(null, this, that, { testFormula: "=this.name" });',
                        name: 'Friend',
                        testFormula: '=this.name',

                        // the new bot is not destroyed
                    },
                }),
            ]);
        });

        it('should not destroy the bots when running a non combine event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef(#name:"Joe")': 'create(null, this)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot', 'thatBot']);
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef(#name:"Joe")': 'create(null, this)',
                    },
                }),
            ]);
        });

        it('should run actions when no filter is provided', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()': 'create(null, this)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot', 'thatBot']);
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()': 'create(null, this)',
                    },
                }),
            ]);
        });

        it('should calculate events from setting property values', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()':
                            'setTag(this, "#val", 10); setTag(this, "#nested.value", true)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        val: 10,
                        'nested.value': true,
                    },
                }),
            ]);
        });

        it('should be able to set property values on bots returned from queries', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        'abcdef()':
                            'setTag(getBot("#name", "test"), "#abc", "def")',
                    },
                },
                editBot: {
                    id: 'editBot',
                    tags: {
                        name: 'test',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botUpdated('editBot', {
                    tags: {
                        abc: 'def',
                    },
                }),
            ]);
        });

        it('should be able to set property values on bots returned from other formulas', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        formula: '=getBot("#name", "test")',
                        'abcdef()':
                            'setTag(getTag(this, "#formula"), "#abc", "def")',
                    },
                },
                editBot: {
                    id: 'editBot',
                    tags: {
                        name: 'test',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botUpdated('editBot', {
                    tags: {
                        abc: 'def',
                    },
                }),
            ]);
        });

        it('should be able to increment values on bots returned from other formulas', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        formula: '=getBots("name", "test").first()',
                        'abcdef()':
                            'setTag(getTag(this, "#formula"), "#num", getTag(this, "#formula", "#num") + 2);',
                    },
                },
                editBot: {
                    id: 'editBot',
                    tags: {
                        name: 'test',
                        num: 1,
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botUpdated('editBot', {
                    tags: {
                        num: 3,
                    },
                }),
            ]);
        });

        it('should preserve the user ID in shouts', () => {
            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        'abcdef()': 'shout("sayHello")',
                        'sayHello()':
                            'setTag(this, "#userId", player.getBot().id)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot'], 'userBot');
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        userId: 'userBot',
                    },
                }),
            ]);
        });

        it('should run out of energy in infinite loops', () => {
            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        'test()': 'while(true) {}',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');

            expect(() => {
                calculateActionEvents(state, botAction, createSandbox);
            }).toThrow(new Error('Ran out of energy'));
        });

        it('should support scripts as formulas that return non-string objects', () => {
            expect.assertions(1);

            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        'test()': '=true',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(events.events).toEqual([]);
        });

        it('should support single-line scripts with a comment at the end', () => {
            expect.assertions(1);

            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        'test()': 'player.toast("test"); // this is a test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(events.events).toEqual([toast('test')]);
        });

        it('should support multi-line scripts with a comment at the end', () => {
            expect.assertions(1);

            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        'test()':
                            'player.toast("test"); // comment 1\n// this is a test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(events.events).toEqual([toast('test')]);
        });

        describe('onShout()', () => {
            it('should send a onShout() for actions', () => {
                expect.assertions(1);

                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'onShout()': `
                                setTag(this, 'name', that.name);
                                setTag(this, 'that', that.that);
                                setTag(this, 'targets', that.targets.map(b => b.id));
                                setTag(this, 'listeners', that.listeners.map(b => b.id));
                                setTag(this, 'responses', that.responses);
                            `,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            'test()': 'return 1;',
                        },
                    },
                    bot3: {
                        id: 'bot3',
                        tags: {
                            'test()': 'return 2;',
                        },
                    },
                    bot4: {
                        id: 'bot4',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['bot2', 'bot3', 'bot4'],
                    null,
                    {
                        abc: 'def',
                    }
                );
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            name: 'test',
                            that: {
                                abc: 'def',
                            },
                            targets: ['bot2', 'bot3', 'bot4'],
                            listeners: ['bot2', 'bot3'],
                            responses: [1, 2],
                        },
                    }),
                ]);
            });

            it('should send a onShout() for actions that dont have listeners', () => {
                expect.assertions(1);

                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'onShout()': `
                                setTag(this, 'name', that.name);
                                setTag(this, 'that', that.that);
                                setTag(this, 'targets', that.targets.map(b => b.id));
                                setTag(this, 'listeners', that.listeners.map(b => b.id));
                                setTag(this, 'responses', that.responses);
                            `,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {},
                    },
                    bot3: {
                        id: 'bot3',
                        tags: {},
                    },
                    bot4: {
                        id: 'bot4',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['bot2', 'bot3', 'bot4'],
                    null,
                    {
                        abc: 'def',
                    }
                );
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            name: 'test',
                            that: {
                                abc: 'def',
                            },
                            targets: ['bot2', 'bot3', 'bot4'],
                            listeners: [],
                            responses: [],
                        },
                    }),
                ]);
            });

            it('should send a onShout() for whispers', () => {
                expect.assertions(1);

                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'onShout()': `
                                if (that.name !== 'whisper') {
                                    return;
                                }
                                setTag(this, 'name', that.name);
                                setTag(this, 'that', that.that);
                                setTag(this, 'targets', that.targets.map(b => b.id));
                                setTag(this, 'listeners', that.listeners.map(b => b.id));
                                setTag(this, 'responses', that.responses);
                            `,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            'whisper()': 'return 1;',
                        },
                    },
                    bot3: {
                        id: 'bot3',
                        tags: {},
                    },
                    bot4: {
                        id: 'bot4',
                        tags: {
                            'test()': `whisper(getBots('id', 'bot2'), 'whisper')`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['bot4'], null, {
                    abc: 'def',
                });
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            name: 'whisper',
                            targets: ['bot2'],
                            listeners: ['bot2'],
                            responses: [1],
                        },
                    }),
                ]);
            });

            it('should include extra events from the onShout() call', () => {
                expect.assertions(1);

                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'onShout()': `player.toast('Hi!');`,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            'test()': 'return 1;',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['bot2']);
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([toast('Hi!')]);
            });

            it('should allow changing responses', () => {
                expect.assertions(1);

                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'onShout()': `
                                if (that.name !== 'number') {
                                    return;
                                }
                                for (let i = 0; i < that.responses.length; i++) {
                                    that.responses[i] = that.responses[i] * 2;
                                }
                            `,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            'number()': 'return 1;',
                        },
                    },
                    bot3: {
                        id: 'bot3',
                        tags: {
                            'number()': 'return 2;',
                        },
                    },
                    bot4: {
                        id: 'bot4',
                        tags: {
                            'test()': `
                                setTag(this, 'responses', shout('number'))
                            `,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['bot4']);
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot4', {
                        tags: {
                            responses: [2, 4],
                        },
                    }),
                ]);
            });

            it('should allow removing responses', () => {
                expect.assertions(1);

                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'onShout()': `
                                if (that.name !== 'number') {
                                    return;
                                }
                                that.responses.length = 0;
                            `,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            'number()': 'return 1;',
                        },
                    },
                    bot3: {
                        id: 'bot3',
                        tags: {
                            'number()': 'return 2;',
                        },
                    },
                    bot4: {
                        id: 'bot4',
                        tags: {
                            'test()': `
                                setTag(this, 'responses', shout('number'))
                            `,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['bot4']);
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot4', {
                        tags: {
                            responses: [],
                        },
                    }),
                ]);
            });

            it('should allow adding responses', () => {
                expect.assertions(1);

                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'onShout()': `
                                if (that.name !== 'number') {
                                    return;
                                }
                                that.responses.unshift(0);
                            `,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            'number()': 'return 1;',
                        },
                    },
                    bot3: {
                        id: 'bot3',
                        tags: {
                            'number()': 'return 2;',
                        },
                    },
                    bot4: {
                        id: 'bot4',
                        tags: {
                            'test()': `
                                setTag(this, 'responses', shout('number'))
                            `,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['bot4']);
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot4', {
                        tags: {
                            responses: [0, 1, 2],
                        },
                    }),
                ]);
            });
        });

        describe('arguments', () => {
            it('should not convert the argument to a proxy object if it is a bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'this.hi = that.hi',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot'],
                    null,
                    state.otherBot
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should not convert the argument to a list of proxy objects if it is a list of bots', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'this.hi = that[0].hi; this.l = that.length',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], null, [
                    state.otherBot,
                ]);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should not convert the argument fields to proxy objects if they are bots', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'this.hi = that.bot.hi',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], null, {
                    bot: state.otherBot,
                    num: 100,
                });
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should not convert nested fields to proxy objects', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'this.hi = that.bots[0].hi',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], null, {
                    bots: [state.otherBot],
                });
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should handle null arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'setTag(this, "#hi", "test")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], null, null);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hi: 'test',
                        },
                    }),
                ]);
            });
        });

        const trimEventCases = [
            ['parenthesis', 'sayHello()'],
            ['hashtag', '#sayHello'],
            ['hashtag and parenthesis', '#sayHello()'],
        ];

        describe('shout()', () => {
            it('should run the event on every bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'shout("sayHello")',
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('otherBot', {
                        tags: {
                            hello: true,
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            });

            it('should set the given argument as the that variable', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'let o = { hi: "test" }; shout("sayHello", o)',
                            'sayHello()': 'setTag(this, "#hello", that.hi)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should handle passing bots as arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'shout("sayHello", getBot("#name", "other"))',
                            'sayHello()':
                                'setTag(this, "#hello", getTag(that, "#hi"))',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should be able to modify bots that are arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'shout("sayHello", getBot("#name", "other"))',
                            'sayHello()': 'setTag(that, "#hello", "test")',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('otherBot', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should handle bots nested in an object as an argument', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'let o = { other: getBot("#name", "other") }; shout("sayHello", o)',
                            'sayHello()':
                                'setTag(that.other, "#hello", "test")',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('otherBot', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should handle primitive values', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'shout("sayHello", true)',
                            'sayHello()': 'setTag(this, "#hello", that)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            });

            it('should process the message synchronously', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'shout("sayHello", getBot("#name", "other")); setTag(this, "#value", getTag(getBot("#name", "other"), "#hello"))',
                            'sayHello()': 'setTag(that, "#hello", "test")',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('otherBot', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            value: 'test',
                        },
                    }),
                ]);
            });

            it('should return an array of results from the other formulas', () => {
                const state: BotsState = {
                    bBot: {
                        id: 'bBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'let results = shout("sayHello", "test"); setTag(this, "result", results);',
                            'sayHello()': 'return "Wrong, " + that;',
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            'sayHello()': 'return "Hello, " + that;',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['bBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('bBot', {
                        tags: {
                            result: ['Hello, test', 'Wrong, test'],
                        },
                    }),
                ]);
            });

            it.each(trimEventCases)(
                'should handle %s in the event name.',
                (desc, eventName) => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                _position: { x: 0, y: 0, z: 0 },
                                _workspace: 'abc',
                                'abcdef()': `shout("${eventName}")`,
                                'sayHello()': 'setTag(this, "#hello", true)',
                            },
                        },
                    };

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const botAction = action('abcdef', ['thisBot']);
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
                        botUpdated('thisBot', {
                            tags: {
                                hello: true,
                            },
                        }),
                    ]);
                }
            );
        });

        describe('superShout()', () => {
            it('should emit a super_shout local event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'superShout("sayHello")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([superShout('sayHello')]);
            });

            it.each(trimEventCases)(
                'should handle %s in the event name.',
                (desc, eventName) => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                _position: { x: 0, y: 0, z: 0 },
                                _workspace: 'abc',
                                'abcdef()': `superShout("${eventName}")`,
                            },
                        },
                    };

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const botAction = action('abcdef', ['thisBot']);
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([superShout('sayHello')]);
                }
            );
        });

        describe('whisper()', () => {
            it('should send an event only to the given bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'whisper(this, "sayHello")',
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            });

            it('should send an event only to the given list of bots', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'whisper(getBots("#hello"), "sayHello")',
                        },
                    },
                    thatBot: {
                        id: 'thatBot',
                        tags: {
                            hello: true,
                            'sayHello()': 'setTag(this, "#saidHello", true)',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            hello: true,
                            'sayHello()': 'setTag(this, "#saidHello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('otherBot', {
                        tags: {
                            saidHello: true,
                        },
                    }),
                    botUpdated('thatBot', {
                        tags: {
                            saidHello: true,
                        },
                    }),
                ]);
            });

            it('should return an array of results from the other formulas ordered by how they were given', () => {
                const state: BotsState = {
                    aBot: {
                        id: 'aBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'let results = whisper(["bBot", "aBot"], "sayHello", "test"); setTag(this, "result", results);',
                            'sayHello()': 'return "Wrong, " + that',
                        },
                    },
                    bBot: {
                        id: 'bBot',
                        tags: {
                            'sayHello()': 'return "Hello, " + that',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['aBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('aBot', {
                        tags: {
                            result: ['Hello, test', 'Wrong, test'],
                        },
                    }),
                ]);
            });

            it.each(trimEventCases)(
                'should handle %s in the event name.',
                (desc, eventName) => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                _position: { x: 0, y: 0, z: 0 },
                                _workspace: 'abc',
                                'abcdef()': `whisper(this, "${eventName}")`,
                                'sayHello()': 'setTag(this, "#hello", true)',
                            },
                        },
                    };

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const botAction = action('abcdef', ['thisBot']);
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
                        botUpdated('thisBot', {
                            tags: {
                                hello: true,
                            },
                        }),
                    ]);
                }
            );
        });

        describe('webhook()', () => {
            it('should emit a SendWebhookAction', () => {
                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'test()': `webhook({
                                method: 'POST',
                                url: 'https://example.com',
                                data: {
                                    test: 'abc'
                                },
                                responseShout: 'test.response()'
                            })`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['bot1']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    webhook({
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    }),
                ]);
            });
        });

        describe('webhook.post()', () => {
            it('should emit a SendWebhookAction', () => {
                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'test()': `webhook.post('https://example.com', { test: 'abc' }, {
                                responseShout: 'test.response()'
                            })`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['bot1']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    webhook({
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    }),
                ]);
            });
        });

        describe('removeTags()', () => {
            it('should remove the given tag sections on the given bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'create()':
                                'let newBot = create(this, { stay: "def", "leave.x": 0, "leave.y": 0 }); removeTags(newBot, "leave");',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('create', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            stay: 'def',
                            'leave.x': 0,
                            'leave.y': 0,
                            'aux.creator': 'thisBot',
                        },
                    }),
                    botUpdated('uuid-0', {
                        tags: {
                            'leave.x': null,
                            'leave.y': null,
                        },
                    }),
                ]);
            });
        });

        describe('create()', () => {
            it('should create a new bot with aux.creator set to the original id', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'create(this, { abc: "def" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            'aux.creator': 'thisBot',
                        },
                    }),
                ]);
            });

            it('should create a new bot with aux.creator set to the given id', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'create("thisBot", { abc: "def" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            'aux.creator': 'thisBot',
                        },
                    }),
                ]);
            });

            it('should not allow overriding aux.creator', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'create("thisBot", { "aux.creator": "def" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisBot',
                        },
                    }),
                ]);
            });

            it('should support multiple arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'create("thisBot", { abc: "def" }, { ghi: 123 })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            ghi: 123,
                            'aux.creator': 'thisBot',
                        },
                    }),
                ]);
            });

            it('should support bots as arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'create("thisBot", getBots("name", "that"))',
                        },
                    },
                    thatBot: {
                        id: 'thatBot',
                        tags: {
                            name: 'that',
                            abc: 'def',
                            formula: '=this.abc',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            name: 'that',
                            formula: '=this.abc',
                            'aux.creator': 'thisBot',
                        },
                    }),
                ]);
            });

            it('should return the created bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#newBotId", create(null, { abc: "def" }).id)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            newBotId: 'uuid-0',
                        },
                    }),
                ]);
            });

            it('should support modifying the returned bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'let newBot = create(null, { abc: "def" }); setTag(newBot, "#fun", true); setTag(newBot, "#num", 123);',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                        },
                    }),
                    botUpdated('uuid-0', {
                        tags: {
                            fun: true,
                            num: 123,
                        },
                    }),
                ]);
            });

            it('should add the new bot to the formulas', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'create(null, { name: "bob" }); setTag(this, "#botId", getBot("#name", "bob").id)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            name: 'bob',
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            botId: 'uuid-0',
                        },
                    }),
                ]);
            });

            it('should support formulas on the new bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'let newBot = create(null, { formula: "=getTag(this, \\"#num\\")", num: 100 }); setTag(this, "#result", getTag(newBot, "#formula"));',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            formula: '=getTag(this, "#num")',
                            num: 100,
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            result: 100,
                        },
                    }),
                ]);
            });

            it('should return normal javascript objects', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            num: 100,
                            'test()':
                                'let newBot = create(this, { abc: getTag(this, "#num") });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisBot',
                            abc: 100,
                        },
                    }),
                ]);
            });

            it('should trigger onCreate() on the created bot.', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            num: 1,
                            'test()':
                                'create(this, { abc: getTag(this, "#num"), "onCreate()": "setTag(this, \\"#num\\", 100)" });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisBot',
                            abc: 1,
                            'onCreate()': 'setTag(this, "#num", 100)',
                        },
                    }),
                    botUpdated('uuid-0', {
                        tags: {
                            num: 100,
                        },
                    }),
                ]);
            });

            it('should support arrays of diffs as arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#num", create("thisBot", [ { hello: true }, { hello: false } ]).length)',
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: true,
                        },
                    }),
                    botAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: false,
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            num: 2,
                        },
                    }),
                ]);
            });

            it('should create every combination of diff', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#num", create("thisBot", [ { hello: true }, { hello: false } ], [ { wow: 1 }, { oh: "haha" }, { test: "a" } ]).length)',
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: true,
                            wow: 1,
                        },
                    }),
                    botAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: false,
                            wow: 1,
                        },
                    }),
                    botAdded({
                        id: 'uuid-2',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: true,
                            oh: 'haha',
                        },
                    }),
                    botAdded({
                        id: 'uuid-3',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: false,
                            oh: 'haha',
                        },
                    }),
                    botAdded({
                        id: 'uuid-4',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: true,
                            test: 'a',
                        },
                    }),
                    botAdded({
                        id: 'uuid-5',
                        tags: {
                            'aux.creator': 'thisBot',
                            hello: false,
                            test: 'a',
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            num: 6,
                        },
                    }),
                ]);
            });

            it('should duplicate each of the bots in the list', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'create("thisBot", getBots("test", true))',
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            hello: true,
                        },
                    },
                    bBot: {
                        id: 'bBot',
                        tags: {
                            test: true,
                            hello: false,
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisBot',
                            test: true,
                            hello: true,
                        },
                    }),
                    botAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux.creator': 'thisBot',
                            test: true,
                            hello: false,
                        },
                    }),
                ]);
            });
        });

        describe('combine()', () => {
            it('should send the combine event to the given bots', () => {
                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'test()': 'combine(this, getBot("#abc", true))',
                            'onCombine(#abc:true)':
                                'setTag(this, "otherId", that.bot.id)',
                            def: true,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            abc: true,
                            'onCombine(#def:true)':
                                'setTag(this, "otherId", that.bot.id)',
                        },
                    },
                };

                const botAction = action('test', ['bot1']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            otherId: 'bot2',
                        },
                    }),
                    botUpdated('bot2', {
                        tags: {
                            otherId: 'bot1',
                        },
                    }),
                ]);
            });

            it('should merge the given argument with the bot argument', () => {
                const state: BotsState = {
                    bot1: {
                        id: 'bot1',
                        tags: {
                            'test()':
                                'combine(this, getBot("#abc", true), { context: "myContext" })',
                            'onCombine(#abc:true)':
                                'setTag(this, "otherId", that.context)',
                            def: true,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            abc: true,
                            'onCombine(#def:true)':
                                'setTag(this, "otherId", that.context)',
                        },
                    },
                };

                const botAction = action('test', ['bot1']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            otherId: 'myContext',
                        },
                    }),
                    botUpdated('bot2', {
                        tags: {
                            otherId: 'myContext',
                        },
                    }),
                ]);
            });
        });

        describe('destroy()', () => {
            it('should destroy and bots that have aux.creator set to the bot ID', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'destroy(this)',
                        },
                    },
                    childBot: {
                        id: 'childBot',
                        tags: {
                            'aux.creator': 'thisBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botRemoved('thisBot'),
                    botRemoved('childBot'),
                ]);
            });

            it('should recursively destroy bots that have aux.creator set to the bot ID', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'destroy(this)',
                        },
                    },
                    childBot: {
                        id: 'childBot',
                        tags: {
                            'aux.creator': 'thisBot',
                        },
                    },
                    childChildBot: {
                        id: 'childChildBot',
                        tags: {
                            'aux.creator': 'childBot',
                        },
                    },
                    otherChildBot: {
                        id: 'otherChildBot',
                        tags: {
                            'aux.creator': 'thisBot',
                        },
                    },
                    otherChildChildBot: {
                        id: 'otherChildChildBot',
                        tags: {
                            'aux.creator': 'otherChildBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botRemoved('thisBot'),
                    botRemoved('childBot'),
                    botRemoved('childChildBot'),
                    botRemoved('otherChildBot'),
                    botRemoved('otherChildChildBot'),
                ]);
            });

            it('should support an array of bots to destroy', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'destroy(getBots("clone"));',
                        },
                    },
                    bot1: {
                        id: 'bot1',
                        tags: {
                            clone: true,
                            test1: true,
                        },
                    },
                    bot2: {
                        id: 'bot2',
                        tags: {
                            clone: true,
                            test2: true,
                        },
                    },
                };

                // specify the UUID to use next
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botRemoved('bot1'),
                    botRemoved('bot2'),
                ]);
            });

            it('should trigger onDestroy()', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'onDestroy()':
                                'setTag(getBot("#name", "other"), "#num", 100)',
                            'test()': 'destroy(this)',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    // This is weird because it means that an update for a bot could happen
                    // after it gets removed but I currently don't have a great solution for it at the moment.
                    botRemoved('thisBot'),
                    botUpdated('otherBot', {
                        tags: {
                            num: 100,
                        },
                    }),
                ]);
            });

            it('should not destroy bots that are not destroyable', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'destroy(this)',
                            'onDestroy()':
                                'setTag(getBot("abc", "def"), "name", "bob")',
                            'aux.destroyable': false,
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            abc: 'def',
                        },
                    },
                    childBot: {
                        id: 'childBot',
                        tags: {
                            'aux.creator': 'thisBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);
            });

            it('should short-circut destroying child bots', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'destroy(this)',
                        },
                    },
                    childBot: {
                        id: 'childBot',
                        tags: {
                            'aux.creator': 'thisBot',
                            'aux.destroyable': false,
                        },
                    },
                    grandChildBot: {
                        id: 'grandChildBot',
                        tags: {
                            'aux.creator': 'childBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([botRemoved('thisBot')]);
            });

            it('should be able to destroy a bot that was just created', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'let bot = create(); destroy(bot)',
                        },
                    },
                };

                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded(createBot('uuid-0')),
                    botRemoved('uuid-0'),
                ]);
            });

            it('should remove the destroyed bot from searches', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            abc: true,
                            'test()':
                                'destroy(this); player.toast(getBot("abc", true));',
                        },
                    },
                };

                // specify the UUID to use next
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botRemoved('thisBot'),
                    toast(undefined),
                ]);
            });
        });

        describe('player.getBot()', () => {
            it('should get the current users bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(player.getBot(), "#name", "Test")',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('userBot', {
                        tags: {
                            name: 'Test',
                        },
                    }),
                ]);
            });
        });

        describe('addToMenuDiff()', () => {
            it('should add the given bot to the users menu', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'addItem()':
                                'mod.apply(getBot("#name", "bob"), mod.addToMenu())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._userMenuContext': 'context',
                        },
                    },
                    menuBot: {
                        id: 'menuBot',
                        tags: {
                            name: 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'addItem',
                    ['thisBot', 'userBot', 'menuBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('menuBot', {
                        tags: {
                            'context.id': 'uuid-0',
                            'context.sortOrder': 0,
                            context: true,
                            'context.x': 0,
                            'context.y': 0,
                        },
                    }),
                ]);
            });
        });

        describe('removeFromMenuDiff()', () => {
            it('should remove the given bot from the users menu', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'addItem()':
                                'mod.apply(getBots("name", "bob").first(), mod.removeFromMenu())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._userMenuContext': 'context',
                        },
                    },
                    menuBot: {
                        id: 'menuBot',
                        tags: {
                            name: 'bob',
                            context: 0,
                            'context.id': 'abcdef',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'addItem',
                    ['thisBot', 'userBot', 'menuBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('menuBot', {
                        tags: {
                            'context.id': null,
                            'context.sortOrder': null,
                            context: null,
                            'context.x': null,
                            'context.y': null,
                        },
                    }),
                ]);
            });
        });

        describe('mod.apply()', () => {
            it('should update the given bot with the given diff', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, { abc: "def", ghi: true, num: 1 })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            abc: 'def',
                            ghi: true,
                            num: 1,
                        },
                    }),
                ]);
            });

            it('should support multiple', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, { abc: "def", ghi: true, num: 1 }, { abc: "xyz" });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            abc: 'xyz',
                            ghi: true,
                            num: 1,
                        },
                    }),
                ]);
            });

            it('should apply the values to the bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            abc: 123,
                            'test()':
                                'mod.apply(this, { abc: "def", ghi: true, num: 1 }); mod.apply(this, { "abc": getTag(this, "#abc") })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            abc: 'def',
                            ghi: true,
                            num: 1,
                        },
                    }),
                ]);
            });

            it('should send a onMod() event to the affected bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            abc: 123,
                            'onMod()': 'setTag(this, "#diffed", true)',
                            'test()':
                                'mod.apply(this, { abc: "def", ghi: true, num: 1 });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            diffed: true,
                            abc: 'def',
                            ghi: true,
                            num: 1,
                        },
                    }),
                ]);
            });

            it('should support merging mods into mods', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `let m = { abc: true }; mod.apply(m, { def: 123 }); mod.apply(this, m);`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            abc: true,
                            def: 123,
                        },
                    }),
                ]);
            });
        });

        describe('addToContextDiff()', () => {
            it('should add the bot to the given context', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.addToContext("abc"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            abc: true,
                            'abc.x': 0,
                            'abc.y': 0,
                            'abc.sortOrder': 0,
                        },
                    }),
                ]);
            });
        });

        describe('removeFromContextDiff()', () => {
            it('should remove the bot from the given context', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            abc: true,
                            'test()':
                                'mod.apply(this, mod.removeFromContext("abc"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            abc: null,
                            'abc.x': null,
                            'abc.y': null,
                            'abc.sortOrder': null,
                        },
                    }),
                ]);
            });
        });

        describe('setPositionDiff()', () => {
            it('should return a diff that sets the bot position in a context when applied', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.setPosition("abc", 1, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            'abc.x': 1,
                            'abc.y': 2,
                        },
                    }),
                ]);
            });

            it('should ignore components that are not defined', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.setPosition("abc", undefined, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            'abc.y': 2,
                        },
                    }),
                ]);
            });

            it('should be able to set the index', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.setPosition("abc", undefined, undefined, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            'abc.sortOrder': 2,
                        },
                    }),
                ]);
            });
        });

        describe('getUserMenuContext()', () => {
            it('should return the aux._userMenuContext tag from the user bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#context", player.getMenuContext())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._userMenuContext': 'abc',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            context: 'abc',
                        },
                    }),
                ]);
            });
        });

        describe('toast()', () => {
            it('should emit a ShowToastAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.toast("hello, world!")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([toast('hello, world!')]);
            });
        });

        describe('player.tweenTo()', () => {
            it('should emit a TweenToAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.tweenTo("test")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([tweenTo('test')]);
            });

            it('should handle bots', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.tweenTo(this)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([tweenTo('thisBot')]);
            });

            it('should support specifying a duration', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'player.tweenTo("test", undefined, undefined, undefined, 10)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    tweenTo('test', undefined, undefined, undefined, 10),
                ]);
            });
        });

        describe('player.moveTo()', () => {
            it('should emit a TweenToAction with the duration set to 0', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.moveTo("test")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    {
                        type: 'tween_to',
                        botId: 'test',
                        zoomValue: null,
                        rotationValue: null,
                        duration: 0,
                    },
                ]);
            });
        });

        describe('openQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.openQRCodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openQRCodeScanner(true)]);
            });
        });

        describe('closeQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.closeQRCodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openQRCodeScanner(false)]);
            });
        });

        describe('showQRCode()', () => {
            it('should emit a ShowQRCodeAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.showQRCode("hello")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showQRCode(true, 'hello')]);
            });
        });

        describe('hideQRCode()', () => {
            it('should emit a ShowQRCodeAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.hideQRCode()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showQRCode(false)]);
            });
        });

        describe('openBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.openBarcodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openBarcodeScanner(true)]);
            });
        });

        describe('closeBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.closeBarcodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openBarcodeScanner(false)]);
            });
        });

        describe('showBarcode()', () => {
            it('should emit a ShowBarcodeAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.showBarcode("hello")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showBarcode(true, 'hello')]);
            });

            it('should include the given format', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.showBarcode("hello", "format")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showBarcode(true, 'hello', <any>'format'),
                ]);
            });
        });

        describe('hideBarcode()', () => {
            it('should emit a ShowBarcodeAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.hideBarcode()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showBarcode(false)]);
            });
        });

        describe('loadChannel()', () => {
            it('should emit a LoadSimulationAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.loadChannel("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([loadSimulation('abc')]);
            });
        });

        describe('unloadChannel()', () => {
            it('should emit a UnloadSimulationAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.unloadChannel("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([unloadSimulation('abc')]);
            });
        });

        describe('loadAUX()', () => {
            it('should emit a ImportdAUXEvent', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.importAUX("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([importAUX('abc')]);
            });
        });

        describe('isConnected()', () => {
            it('should get the aux.connected property from the current user bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#fun", player.isConnected())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux.connected': true,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            fun: true,
                        },
                    }),
                ]);
            });

            it('should default to false when there is no user', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#fun", player.isConnected())',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            fun: false,
                        },
                    }),
                ]);
            });

            it('should default to false', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#fun", player.isConnected())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            fun: false,
                        },
                    }),
                ]);
            });
        });

        describe('player.isInContext()', () => {
            it('should return true when aux._userContext equals the given value', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#inContext", player.isInContext("context"))',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._userContext': 'context',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            inContext: true,
                        },
                    }),
                ]);
            });

            it('should return false when aux._userContext does not equal the given value', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#inContext", player.isInContext("abc"))',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._userContext': 'context',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            inContext: false,
                        },
                    }),
                ]);
            });

            it('should return false when aux._userContext is not set', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#inContext", player.isInContext("abc"))',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            inContext: false,
                        },
                    }),
                ]);
            });
        });

        describe('player.currentContext()', () => {
            it('should return aux._userContext', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#context", player.currentContext())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._userContext': 'context',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            context: 'context',
                        },
                    }),
                ]);
            });

            it('should return undefined when aux._userContext is not set', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#context", player.currentContext())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            context: undefined,
                        },
                    }),
                ]);
            });
        });

        describe('player.isDesigner()', () => {
            it('should return true when the player is apart of the global bot builder list', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#isBuilder", player.isDesigner())',
                        },
                    },
                    config: {
                        id: 'config',
                        tags: {
                            'aux.designers': 'bob',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._user': 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            isBuilder: true,
                        },
                    }),
                ]);
            });

            it('should return false when the player is not apart of the global bot builder list', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#isBuilder", player.isDesigner())',
                        },
                    },
                    config: {
                        id: 'config',
                        tags: {
                            'aux.designers': 'otherUser',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._user': 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            isBuilder: false,
                        },
                    }),
                ]);
            });

            it('should return true when there are no designers', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#isBuilder", player.isDesigner())',
                        },
                    },
                    config: {
                        id: 'config',
                        tags: {},
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._user': 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            isBuilder: true,
                        },
                    }),
                ]);
            });
        });

        describe('player.showInputForTag()', () => {
            it('should emit a ShowInputForTagAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.showInputForTag(this, "abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showInputForTag('thisBot', 'abc'),
                ]);
            });

            it('should support passing a bot ID', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.showInputForTag("test", "abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showInputForTag('test', 'abc')]);
            });

            it('should trim the first hash from the tag', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'player.showInputForTag("test", "##abc"); player.showInputForTag("test", "#abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showInputForTag('test', '#abc'),
                    showInputForTag('test', 'abc'),
                ]);
            });

            it('should support extra options', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'player.showInputForTag("test", "abc", { backgroundColor: "red", foregroundColor: "green" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showInputForTag('test', 'abc', {
                        backgroundColor: 'red',
                        foregroundColor: 'green',
                    }),
                ]);
            });
        });

        describe('goToContext()', () => {
            it('should issue a GoToContext event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.goToContext("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToContext('abc')]);
            });

            it('should ignore extra parameters', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.goToContext("sim", "abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToContext('sim')]);
            });
        });

        describe('player.goToURL()', () => {
            it('should issue a GoToURL event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.goToURL("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToURL('abc')]);
            });
        });

        describe('player.openURL()', () => {
            it('should issue a OpenURL event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.openURL("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openURL('abc')]);
            });
        });

        describe('player.openDevConsole()', () => {
            it('should issue a OpenConsole event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'player.openDevConsole()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([openConsole()]);
            });
        });

        describe('mod.export()', () => {
            it('should serialize the given object to JSON', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#json", mod.export({ abc: "def" }))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            json: '{"abc":"def"}',
                        },
                    }),
                ]);
            });
        });

        describe('mod.import()', () => {
            it('should create a diff that applies the given tags from the given bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.import(getBot("#name", "bob"), "val", /test\\..+/))',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'bob',
                            val: 123,
                            'test.fun': true,
                            'test.works': 'yes',
                            'even.test.wow': 456,
                            'test.': 'no',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            val: 123,
                            'test.fun': true,
                            'test.works': 'yes',
                            'even.test.wow': 456,
                        },
                    }),
                ]);
            });

            it('should create a diff with all tags if no filters are given', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.import(getBots("name", "bob").first()))',
                        },
                    },
                    otherBot: {
                        id: 'otherBot',
                        tags: {
                            name: 'bob',
                            val: 123,
                            'test.fun': true,
                            'test.works': 'yes',
                            'even.test.wow': 456,
                            'test.': 'no',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            name: 'bob',
                            val: 123,
                            'test.fun': true,
                            'test.works': 'yes',
                            'even.test.wow': 456,
                            'test.': 'no',
                        },
                    }),
                ]);
            });

            it('should create a diff from another diff', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.import({abc: true, val: 123}, "val"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            val: 123,
                        },
                    }),
                ]);
            });

            it('should create a diff from JSON', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `mod.apply(this, mod.import('{"abc": true, "val": 123}', "val"))`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            val: 123,
                        },
                    }),
                ]);
            });
        });

        describe('setTag()', () => {
            it('should issue a bot update for the given tag', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'setTag(this, "#name", "bob")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            name: 'bob',
                        },
                    }),
                ]);
            });

            it('should issue a bot update for the given tag on multiple bots', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'setTag(this, "#name", "bob")',
                        },
                    },

                    thatBot: {
                        id: 'thatBot',
                        tags: {
                            'test()': 'setTag(getBots("id"), "#name", "bob")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thatBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thatBot', {
                        tags: {
                            name: 'bob',
                        },
                    }),

                    botUpdated('thisBot', {
                        tags: {
                            name: 'bob',
                        },
                    }),
                ]);
            });

            it('should make future getTag() calls use the set value', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()':
                                'setTag(this, "#name", "bob"); setTag(this, "#abc", getTag(this, "#name"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            name: 'bob',
                            abc: 'bob',
                        },
                    }),
                ]);
            });
        });

        describe('server.echo()', () => {
            it('should send a EchoAction in a RemoteAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'server.echo("message")',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(echo('message'))]);
            });
        });

        describe('server.sayHello()', () => {
            it('should send a SayHelloAction in a RemoteAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'server.sayHello()',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(sayHello())]);
            });
        });

        describe('server.grantRole()', () => {
            it('should send a GrantRoleAction in a RemoteAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'server.grantRole("abc", "def")',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(grantRole('abc', 'def')),
                ]);
            });
        });

        describe('server.revokeRole()', () => {
            it('should send a RevokeRoleAction in a RemoteAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'server.revokeRole("abc", "def")',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(revokeRole('abc', 'def')),
                ]);
            });
        });

        describe('server.shell()', () => {
            it('should emit a remote shell event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'server.shell("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(shell('abc'))]);
            });
        });

        describe('server.backupToGithub()', () => {
            it('should emit a remote backup to github event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'server.backupToGithub("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(backupToGithub('abc'))]);
            });
        });

        describe('server.backupAsDownload()', () => {
            it('should emit a remote backup as download event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': 'server.backupAsDownload()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(backupAsDownload())]);
            });
        });

        describe('player.checkout()', () => {
            it('should emit a start checkout event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `player.checkout({
                                productId: 'ID1',
                                title: 'Product 1',
                                description: '$50.43',
                                processingChannel: 'channel2'
                            })`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    checkout({
                        productId: 'ID1',
                        title: 'Product 1',
                        description: '$50.43',
                        processingChannel: 'channel2',
                    }),
                ]);
            });
        });

        describe('server.finishCheckout()', () => {
            it('should emit a finish checkout event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `server.finishCheckout({
                                token: 'token1',
                                description: 'Test',
                                amount: 100,
                                currency: 'usd'
                            })`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    finishCheckout('token1', 100, 'usd', 'Test'),
                ]);
            });

            it('should include extra info', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `server.finishCheckout({
                                token: 'token1',
                                description: 'Test',
                                amount: 100,
                                currency: 'usd',
                                extra: {
                                    abc: 'def'
                                }
                            })`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    finishCheckout('token1', 100, 'usd', 'Test', {
                        abc: 'def',
                    }),
                ]);
            });
        });

        describe('remote()', () => {
            const cases = [
                ['player.toast("My Message!")', toast('My Message!')],
                ['player.goToContext("context")', goToContext('context')],
                ['player.openURL("url")', openURL('url')],
                ['player.goToURL("url")', goToURL('url')],
                ['player.tweenTo("id")', tweenTo('id')],
                ['player.openURL("url")', openURL('url')],
                ['player.openQRCodeScanner()', openQRCodeScanner(true)],
                ['player.closeQRCodeScanner()', openQRCodeScanner(false)],
                ['player.openBarcodeScanner()', openBarcodeScanner(true)],
                ['player.closeBarcodeScanner()', openBarcodeScanner(false)],
                ['player.showBarcode("code")', showBarcode(true, 'code')],
                ['player.hideBarcode()', showBarcode(false)],
                ['player.loadChannel("channel")', loadSimulation('channel')],
                [
                    'player.unloadChannel("channel")',
                    unloadSimulation('channel'),
                ],
                ['player.importAUX("aux")', importAUX('aux')],
                ['player.showQRCode("code")', showQRCode(true, 'code')],
                ['player.hideQRCode()', showQRCode(false)],
                [
                    'player.showInputForTag(this, "abc")',
                    showInputForTag('thisBot', 'abc'),
                ],
                [
                    `player.checkout({
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingChannel: 'channel2'
                })`,
                    checkout({
                        productId: 'ID1',
                        title: 'Product 1',
                        description: '$50.43',
                        processingChannel: 'channel2',
                    }),
                ],
                ['player.openDevConsole()', openConsole()],
            ];

            it.each(cases)(
                'should wrap %s in a remote event',
                (script, event) => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                'test()': `remote(${script})`,
                            },
                        },
                    };

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const botAction = action('test', ['thisBot'], 'userBot');
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([remote(event)]);
                }
            );

            it('should send the right selector', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `remote(player.toast("Hi!"), {
                                session: 's',
                                username: 'u',
                                device: 'd'
                            })`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(toast('Hi!'), {
                        sessionId: 's',
                        username: 'u',
                        deviceId: 'd',
                    }),
                ]);
            });
        });
    });

    describe('calculateActionResults()', () => {
        const nonStringScriptCases = [
            ['true', true],
            ['false', false],
            ['0', 0],
        ];
        it.each(nonStringScriptCases)(
            'should include scripts that are formulas but return %s',
            (val, expected) => {
                expect.assertions(2);
                const state: BotsState = {
                    userBot: {
                        id: 'userBot',
                        tags: {},
                    },
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `="return ${val}"`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const [events, results] = calculateActionResults(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events).toEqual([]);
                expect(results).toEqual([expected]);
            }
        );

        const nullScriptCases = ['null', 'undefined', '""'];

        it.each(nullScriptCases)(
            'should skip scripts that are formulas but return %s',
            val => {
                expect.assertions(2);

                const state: BotsState = {
                    userBot: {
                        id: 'userBot',
                        tags: {},
                    },
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            'test()': `=${val}`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const [events, results] = calculateActionResults(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events).toEqual([]);
                expect(results).toEqual([]);
            }
        );

        it('should return the result of the formula', () => {
            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        'test()': 'return 10',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const [events, results] = calculateActionResults(
                state,
                botAction,
                createSandbox
            );

            expect(results).toEqual([10]);
            expect(events).toEqual([]);
        });
    });

    describe('calculateDestroyBotEvents()', () => {
        it('should return a list of events needed to destroy the given bot', () => {
            const bot1 = createBot('bot1');
            const bot2 = createBot('bot2', {
                'aux.creator': 'bot1',
            });
            const bot3 = createBot('bot3', {
                'aux.creator': 'bot2',
            });
            const bot4 = createBot('bot4', {
                'aux.creator': 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createCalculationContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined,
                undefined,
                createSandbox
            );
            const events = calculateDestroyBotEvents(calc, bot1);

            expect(events).toEqual([
                botRemoved('bot1'),
                botRemoved('bot2'),
                botRemoved('bot3'),
                botRemoved('bot4'),
            ]);
        });

        it('should not return a destroy event for bots that are not destroyable', () => {
            const bot1 = createBot('bot1');
            const bot2 = createBot('bot2', {
                'aux.creator': 'bot1',
                'aux.destroyable': false,
            });
            const bot3 = createBot('bot3', {
                'aux.creator': 'bot2',
            });
            const bot4 = createBot('bot4', {
                'aux.creator': 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createCalculationContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined,
                undefined,
                createSandbox
            );
            const events = calculateDestroyBotEvents(calc, bot1);

            expect(events).toEqual([
                botRemoved('bot1'),
                // bot2 and bot3 are not destroyed because they are not destroyable
                botRemoved('bot4'),
            ]);
        });
    });

    describe('calculateFormulaEvents()', () => {
        it('should return the list of events that the formula produced', () => {
            const state: BotsState = {};

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const result = calculateFormulaEvents(
                state,
                'create(null, { name: "bob" })',
                undefined,
                undefined,
                createSandbox
            );

            expect(result).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        name: 'bob',
                    },
                }),
            ]);
        });

        it('should support updating bots', () => {
            const state: BotsState = {
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'bob',
                        test: false,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const result = calculateFormulaEvents(
                state,
                'setTag(getBot("#name", "bob"), "#test", true)',
                undefined,
                undefined,
                createSandbox
            );

            expect(result).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        test: true,
                    },
                }),
            ]);
        });

        it('should use the given user id', () => {
            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {
                        test: true,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const result = calculateFormulaEvents(
                state,
                'create(null, player.getBot())',
                'userBot',
                undefined,
                createSandbox
            );

            expect(result).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        test: true,
                    },
                }),
            ]);
        });
    });

    describe('getBotsForAction()', () => {
        it('should return the list of bots sorted by ID', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {},
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {},
                },
            };

            const botAction = action('test', ['thisBot', 'thatBot']);
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined,
                createSandbox
            );
            const { bots } = getBotsForAction(state, botAction, calc);

            expect(bots).toEqual([state['thatBot'], state['thisBot']]);
        });

        it('should not sort IDs if the action specifies not to', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {},
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {},
                },
            };

            const botAction = action(
                'test',
                ['thisBot', 'thatBot'],
                undefined,
                undefined,
                false
            );
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined,
                createSandbox
            );
            const { bots } = getBotsForAction(state, botAction, calc);

            expect(bots).toEqual([state['thisBot'], state['thatBot']]);
        });
    });
}
