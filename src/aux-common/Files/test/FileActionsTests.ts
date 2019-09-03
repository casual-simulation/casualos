import {
    action,
    fileAdded,
    fileRemoved,
    fileUpdated,
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
} from '../FileEvents';
import {
    COMBINE_ACTION_NAME,
    createFile,
    getActiveObjects,
} from '../FileCalculations';
import { getFilesForAction } from '../FilesChannel';
import {
    calculateActionEvents,
    calculateActionResults,
    calculateDestroyFileEvents,
    calculateFormulaEvents,
} from '../FileActions';
import { FilesState } from '../File';
import { createCalculationContext } from '../FileCalculationContextFactories';
import { SandboxFactory } from '../../Formulas/Sandbox';
import { remote } from '@casual-simulation/causal-trees';

export function fileActionsTests(
    uuidMock: jest.Mock,
    createSandbox?: SandboxFactory
) {
    describe('calculateActionEvents()', () => {
        it('should run scripts on the this file and return the resulting actions', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'onCombine(#name:"Joe")':
                            'create(null, this);destroy(this);destroy(that);',
                        'onCombine(#name:"Friend")':
                            'create(null, this, { bad: true })',
                    },
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action(COMBINE_ACTION_NAME, [
                'thisFile',
                'thatFile',
            ]);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'onCombine(#name:"Joe")':
                            'create(null, this);destroy(this);destroy(that);',
                        'onCombine(#name:"Friend")':
                            'create(null, this, { bad: true })',

                        // the new file is not destroyed
                    },
                }),
                fileRemoved('thisFile'),
                fileRemoved('thatFile'),
            ]);
        });

        it('should preserve formulas when copying', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        'onCombine(#name:"Friend")':
                            'create(null, this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
                    },
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        name: 'Friend',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action(COMBINE_ACTION_NAME, [
                'thisFile',
                'thatFile',
            ]);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        'onCombine(#name:"Friend")':
                            'create(null, this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
                        name: 'Friend',
                        testFormula: '=this.name',

                        // the new file is not destroyed
                    },
                }),
                fileRemoved('thisFile'),
                fileRemoved('thatFile'),
            ]);
        });

        it('should not destroy the files when running a non combine event', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef(#name:"Joe")': 'create(null, this)',
                    },
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('abcdef', ['thisFile', 'thatFile']);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileAdded({
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
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()': 'create(null, this)',
                    },
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('abcdef', ['thisFile', 'thatFile']);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileAdded({
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
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
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
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileUpdated('thisFile', {
                    tags: {
                        val: 10,
                        'nested.value': true,
                    },
                }),
            ]);
        });

        it('should be able to set property values on files returned from queries', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'abcdef()':
                            'setTag(getBot("#name", "test"), "#abc", "def")',
                    },
                },
                editFile: {
                    id: 'editFile',
                    tags: {
                        name: 'test',
                    },
                },
            };

            // specify the UUID to use next
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileUpdated('editFile', {
                    tags: {
                        abc: 'def',
                    },
                }),
            ]);
        });

        it('should be able to set property values on files returned from other formulas', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        formula: '=getBot("#name", "test")',
                        'abcdef()':
                            'setTag(getTag(this, "#formula"), "#abc", "def")',
                    },
                },
                editFile: {
                    id: 'editFile',
                    tags: {
                        name: 'test',
                    },
                },
            };

            // specify the UUID to use next
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileUpdated('editFile', {
                    tags: {
                        abc: 'def',
                    },
                }),
            ]);
        });

        it('should be able to increment values on files returned from other formulas', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        formula: '=getBots("name", "test").first()',
                        'abcdef()':
                            'setTag(getTag(this, "#formula"), "#num", getTag(this, "#formula", "#num") + 2);',
                    },
                },
                editFile: {
                    id: 'editFile',
                    tags: {
                        name: 'test',
                        num: 1,
                    },
                },
            };

            // specify the UUID to use next
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileUpdated('editFile', {
                    tags: {
                        num: 3,
                    },
                }),
            ]);
        });

        it('should preserve the user ID in shouts', () => {
            const state: FilesState = {
                userFile: {
                    id: 'userFile',
                    tags: {},
                },
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'abcdef()': 'shout("sayHello")',
                        'sayHello()':
                            'setTag(this, "#userId", player.getBot().id)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('abcdef', ['thisFile'], 'userFile');
            const result = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileUpdated('thisFile', {
                    tags: {
                        userId: 'userFile',
                    },
                }),
            ]);
        });

        it('should run out of energy in infinite loops', () => {
            const state: FilesState = {
                userFile: {
                    id: 'userFile',
                    tags: {},
                },
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'test()': 'while(true) {}',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('test', ['thisFile'], 'userFile');

            expect(() => {
                calculateActionEvents(state, fileAction, createSandbox);
            }).toThrow(new Error('Ran out of energy'));
        });

        it('should support scripts as formulas that return non-string objects', () => {
            expect.assertions(1);

            const state: FilesState = {
                userFile: {
                    id: 'userFile',
                    tags: {},
                },
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'test()': '=true',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('test', ['thisFile'], 'userFile');
            const events = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(events.events).toEqual([]);
        });

        it('should support single-line scripts with a comment at the end', () => {
            expect.assertions(1);

            const state: FilesState = {
                userFile: {
                    id: 'userFile',
                    tags: {},
                },
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'test()': 'player.toast("test"); // this is a test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('test', ['thisFile'], 'userFile');
            const events = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(events.events).toEqual([toast('test')]);
        });

        it('should support multi-line scripts with a comment at the end', () => {
            expect.assertions(1);

            const state: FilesState = {
                userFile: {
                    id: 'userFile',
                    tags: {},
                },
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'test()':
                            'player.toast("test"); // comment 1\n// this is a test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('test', ['thisFile'], 'userFile');
            const events = calculateActionEvents(
                state,
                fileAction,
                createSandbox
            );

            expect(events.events).toEqual([toast('test')]);
        });

        describe('arguments', () => {
            it('should not convert the argument to a proxy object if it is a file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.hi = that.hi',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'test',
                    ['thisFile'],
                    null,
                    state.otherFile
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should not convert the argument to a list of proxy objects if it is a list of files', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'this.hi = that[0].hi; this.l = that.length',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], null, [
                    state.otherFile,
                ]);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should not convert the argument fields to proxy objects if they are files', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.hi = that.file.hi',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], null, {
                    file: state.otherFile,
                    num: 100,
                });
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should not convert nested fields to proxy objects', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.hi = that.files[0].hi',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], null, {
                    files: [state.otherFile],
                });
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);

                expect(result.events).toEqual([]);
            });

            it('should handle null arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'setTag(this, "#hi", "test")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], null, null);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
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
            it('should run the event on every file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'shout("sayHello")',
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('otherFile', {
                        tags: {
                            hello: true,
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            });

            it('should set the given argument as the that variable', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
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
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should handle passing files as arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'shout("sayHello", getBot("#name", "other"))',
                            'sayHello()':
                                'setTag(this, "#hello", getTag(that, "#hi"))',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                            hi: 'test',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should be able to modify files that are arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'shout("sayHello", getBot("#name", "other"))',
                            'sayHello()': 'setTag(that, "#hello", "test")',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('otherFile', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should handle files nested in an object as an argument', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'let o = { other: getBot("#name", "other") }; shout("sayHello", o)',
                            'sayHello()':
                                'setTag(that.other, "#hello", "test")',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('otherFile', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                ]);
            });

            it('should handle primitive values', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
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
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            });

            it('should process the message synchronously', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'shout("sayHello", getBot("#name", "other")); setTag(this, "#value", getTag(getBot("#name", "other"), "#hello"))',
                            'sayHello()': 'setTag(that, "#hello", "test")',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('otherFile', {
                        tags: {
                            hello: 'test',
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            value: 'test',
                        },
                    }),
                ]);
            });

            it('should return an array of results from the other formulas', () => {
                const state: FilesState = {
                    bFile: {
                        id: 'bFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'let results = shout("sayHello", "test"); setTag(this, "result", results);',
                            'sayHello()': 'return "Wrong, " + that;',
                        },
                    },
                    aFile: {
                        id: 'aFile',
                        tags: {
                            'sayHello()': 'return "Hello, " + that;',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['bFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('bFile', {
                        tags: {
                            result: ['Hello, test', 'Wrong, test'],
                        },
                    }),
                ]);
            });

            it.each(trimEventCases)(
                'should handle %s in the event name.',
                (desc, eventName) => {
                    const state: FilesState = {
                        thisFile: {
                            id: 'thisFile',
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
                    const fileAction = action('abcdef', ['thisFile']);
                    const result = calculateActionEvents(
                        state,
                        fileAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
                        fileUpdated('thisFile', {
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
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'superShout("sayHello")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([superShout('sayHello')]);
            });

            it.each(trimEventCases)(
                'should handle %s in the event name.',
                (desc, eventName) => {
                    const state: FilesState = {
                        thisFile: {
                            id: 'thisFile',
                            tags: {
                                _position: { x: 0, y: 0, z: 0 },
                                _workspace: 'abc',
                                'abcdef()': `superShout("${eventName}")`,
                            },
                        },
                    };

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const fileAction = action('abcdef', ['thisFile']);
                    const result = calculateActionEvents(
                        state,
                        fileAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([superShout('sayHello')]);
                }
            );
        });

        describe('whisper()', () => {
            it('should send an event only to the given file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'whisper(this, "sayHello")',
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            'sayHello()': 'setTag(this, "#hello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            });

            it('should send an event only to the given list of files', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'whisper(getBots("#hello"), "sayHello")',
                        },
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            hello: true,
                            'sayHello()': 'setTag(this, "#saidHello", true)',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            hello: true,
                            'sayHello()': 'setTag(this, "#saidHello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('otherFile', {
                        tags: {
                            saidHello: true,
                        },
                    }),
                    fileUpdated('thatFile', {
                        tags: {
                            saidHello: true,
                        },
                    }),
                ]);
            });

            it('should return an array of results from the other formulas ordered by how they were given', () => {
                const state: FilesState = {
                    aFile: {
                        id: 'aFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()':
                                'let results = whisper(["bFile", "aFile"], "sayHello", "test"); setTag(this, "result", results);',
                            'sayHello()': 'return "Wrong, " + that',
                        },
                    },
                    bFile: {
                        id: 'bFile',
                        tags: {
                            'sayHello()': 'return "Hello, " + that',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['aFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('aFile', {
                        tags: {
                            result: ['Hello, test', 'Wrong, test'],
                        },
                    }),
                ]);
            });

            it.each(trimEventCases)(
                'should handle %s in the event name.',
                (desc, eventName) => {
                    const state: FilesState = {
                        thisFile: {
                            id: 'thisFile',
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
                    const fileAction = action('abcdef', ['thisFile']);
                    const result = calculateActionEvents(
                        state,
                        fileAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
                        fileUpdated('thisFile', {
                            tags: {
                                hello: true,
                            },
                        }),
                    ]);
                }
            );
        });

        describe('removeTags()', () => {
            it('should remove the given tag sections on the given file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'create()':
                                'let newFile = create(this, { stay: "def", "leave.x": 0, "leave.y": 0 }); removeTags(newFile, "leave");',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('create', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            stay: 'def',
                            'leave.x': 0,
                            'leave.y': 0,
                            'aux.creator': 'thisFile',
                        },
                    }),
                    fileUpdated('uuid-0', {
                        tags: {
                            'leave.x': null,
                            'leave.y': null,
                        },
                    }),
                ]);
            });
        });

        describe('create()', () => {
            it('should create a new file with aux.creator set to the original id', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'create(this, { abc: "def" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            'aux.creator': 'thisFile',
                        },
                    }),
                ]);
            });

            it('should create a new file with aux.creator set to the given id', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'create("thisFile", { abc: "def" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            'aux.creator': 'thisFile',
                        },
                    }),
                ]);
            });

            it('should not allow overriding aux.creator', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'create("thisFile", { "aux.creator": "def" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisFile',
                        },
                    }),
                ]);
            });

            it('should support multiple arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'create("thisFile", { abc: "def" }, { ghi: 123 })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            ghi: 123,
                            'aux.creator': 'thisFile',
                        },
                    }),
                ]);
            });

            it('should support files as arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'create("thisFile", getBots("name", "that"))',
                        },
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            name: 'that',
                            abc: 'def',
                            formula: '=this.abc',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                            name: 'that',
                            formula: '=this.abc',
                            'aux.creator': 'thisFile',
                        },
                    }),
                ]);
            });

            it('should return the created file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#newFileId", create(null, { abc: "def" }).id)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            newFileId: 'uuid-0',
                        },
                    }),
                ]);
            });

            it('should support modifying the returned file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'let newFile = create(null, { abc: "def" }); setTag(newFile, "#fun", true); setTag(newFile, "#num", 123);',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            abc: 'def',
                        },
                    }),
                    fileUpdated('uuid-0', {
                        tags: {
                            fun: true,
                            num: 123,
                        },
                    }),
                ]);
            });

            it('should add the new file to the formulas', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'create(null, { name: "bob" }); setTag(this, "#fileId", getBot("#name", "bob").id)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            name: 'bob',
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            fileId: 'uuid-0',
                        },
                    }),
                ]);
            });

            it('should support formulas on the new file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'let newFile = create(null, { formula: "=getTag(this, \\"#num\\")", num: 100 }); setTag(this, "#result", getTag(newFile, "#formula"));',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            formula: '=getTag(this, "#num")',
                            num: 100,
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            result: 100,
                        },
                    }),
                ]);
            });

            it('should return normal javascript objects', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            num: 100,
                            'test()':
                                'let newFile = create(this, { abc: getTag(this, "#num") });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisFile',
                            abc: 100,
                        },
                    }),
                ]);
            });

            it('should trigger onCreate() on the created file.', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            num: 1,
                            'test()':
                                'create(this, { abc: getTag(this, "#num"), "onCreate()": "setTag(this, \\"#num\\", 100)" });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisFile',
                            abc: 1,
                            'onCreate()': 'setTag(this, "#num", 100)',
                        },
                    }),
                    fileUpdated('uuid-0', {
                        tags: {
                            num: 100,
                        },
                    }),
                ]);
            });

            it('should support arrays of diffs as arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#num", create("thisFile", [ { hello: true }, { hello: false } ]).length)',
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: true,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: false,
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            num: 2,
                        },
                    }),
                ]);
            });

            it('should create every combination of diff', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#num", create("thisFile", [ { hello: true }, { hello: false } ], [ { wow: 1 }, { oh: "haha" }, { test: "a" } ]).length)',
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: true,
                            wow: 1,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: false,
                            wow: 1,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-2',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: true,
                            oh: 'haha',
                        },
                    }),
                    fileAdded({
                        id: 'uuid-3',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: false,
                            oh: 'haha',
                        },
                    }),
                    fileAdded({
                        id: 'uuid-4',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: true,
                            test: 'a',
                        },
                    }),
                    fileAdded({
                        id: 'uuid-5',
                        tags: {
                            'aux.creator': 'thisFile',
                            hello: false,
                            test: 'a',
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            num: 6,
                        },
                    }),
                ]);
            });

            it('should duplicate each of the files in the list', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'create("thisFile", getBots("test", true))',
                        },
                    },
                    aFile: {
                        id: 'aFile',
                        tags: {
                            test: true,
                            hello: true,
                        },
                    },
                    bFile: {
                        id: 'bFile',
                        tags: {
                            test: true,
                            hello: false,
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisFile',
                            test: true,
                            hello: true,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux.creator': 'thisFile',
                            test: true,
                            hello: false,
                        },
                    }),
                ]);
            });
        });

        describe('destroy()', () => {
            it('should destroy and files that have aux.creator set to the file ID', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'destroy(this)',
                        },
                    },
                    childFile: {
                        id: 'childFile',
                        tags: {
                            'aux.creator': 'thisFile',
                        },
                    },
                };

                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileRemoved('thisFile'),
                    fileRemoved('childFile'),
                ]);
            });

            it('should recursively destroy files that have aux.creator set to the file ID', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'destroy(this)',
                        },
                    },
                    childFile: {
                        id: 'childFile',
                        tags: {
                            'aux.creator': 'thisFile',
                        },
                    },
                    childChildFile: {
                        id: 'childChildFile',
                        tags: {
                            'aux.creator': 'childFile',
                        },
                    },
                    otherChildFile: {
                        id: 'otherChildFile',
                        tags: {
                            'aux.creator': 'thisFile',
                        },
                    },
                    otherChildChildFile: {
                        id: 'otherChildChildFile',
                        tags: {
                            'aux.creator': 'otherChildFile',
                        },
                    },
                };

                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileRemoved('thisFile'),
                    fileRemoved('childFile'),
                    fileRemoved('childChildFile'),
                    fileRemoved('otherChildFile'),
                    fileRemoved('otherChildChildFile'),
                ]);
            });

            it('should support an array of files to destroy', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'destroy(getBots("clone"));',
                        },
                    },
                    file1: {
                        id: 'file1',
                        tags: {
                            clone: true,
                            test1: true,
                        },
                    },
                    file2: {
                        id: 'file2',
                        tags: {
                            clone: true,
                            test2: true,
                        },
                    },
                };

                // specify the UUID to use next
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileRemoved('file1'),
                    fileRemoved('file2'),
                ]);
            });

            it('should trigger onDestroy()', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'onDestroy()':
                                'setTag(getBot("#name", "other"), "#num", 100)',
                            'test()': 'destroy(this)',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'other',
                        },
                    },
                };

                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    // This is weird because it means that an update for a file could happen
                    // after it gets removed but I currently don't have a great solution for it at the moment.
                    fileRemoved('thisFile'),
                    fileUpdated('otherFile', {
                        tags: {
                            num: 100,
                        },
                    }),
                ]);
            });

            it('should not destroy files that are not destroyable', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'destroy(this)',
                            'onDestroy()':
                                'setTag(getBot("abc", "def"), "name", "bob")',
                            'aux.destroyable': false,
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            abc: 'def',
                        },
                    },
                    childFile: {
                        id: 'childFile',
                        tags: {
                            'aux.creator': 'thisFile',
                        },
                    },
                };

                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);
            });

            it('should short-circut destroying child files', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'destroy(this)',
                        },
                    },
                    childFile: {
                        id: 'childFile',
                        tags: {
                            'aux.creator': 'thisFile',
                            'aux.destroyable': false,
                        },
                    },
                    grandChildFile: {
                        id: 'grandChildFile',
                        tags: {
                            'aux.creator': 'childFile',
                        },
                    },
                };

                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([fileRemoved('thisFile')]);
            });

            it('should be able to destroy a file that was just created', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'let file = create(); destroy(file)',
                        },
                    },
                };

                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    fileAdded(createFile('uuid-0')),
                    fileRemoved('uuid-0'),
                ]);
            });

            it('should remove the destroyed file from searches', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: true,
                            'test()':
                                'destroy(this); player.toast(getBot("abc", true));',
                        },
                    },
                };

                // specify the UUID to use next
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileRemoved('thisFile'),
                    toast(undefined),
                ]);
            });
        });

        describe('player.getBot()', () => {
            it('should get the current users file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(player.getBot(), "#name", "Test")',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'test',
                    ['thisFile', 'userFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('userFile', {
                        tags: {
                            name: 'Test',
                        },
                    }),
                ]);
            });
        });

        describe('addToMenuDiff()', () => {
            it('should add the given file to the users menu', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()':
                                'mod.apply(getBot("#name", "bob"), mod.addToMenu())',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._userMenuContext': 'context',
                        },
                    },
                    menuFile: {
                        id: 'menuFile',
                        tags: {
                            name: 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'addItem',
                    ['thisFile', 'userFile', 'menuFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
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
            it('should remove the given file from the users menu', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()':
                                'mod.apply(getBots("name", "bob").first(), mod.removeFromMenu())',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._userMenuContext': 'context',
                        },
                    },
                    menuFile: {
                        id: 'menuFile',
                        tags: {
                            name: 'bob',
                            context: 0,
                            'context.id': 'abcdef',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'addItem',
                    ['thisFile', 'userFile', 'menuFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
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
            it('should update the given file with the given diff', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, { abc: "def", ghi: true, num: 1 })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            abc: 'def',
                            ghi: true,
                            num: 1,
                        },
                    }),
                ]);
            });

            it('should support multiple', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, { abc: "def", ghi: true, num: 1 }, { abc: "xyz" });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            abc: 'xyz',
                            ghi: true,
                            num: 1,
                        },
                    }),
                ]);
            });

            it('should apply the values to the file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: 123,
                            'test()':
                                'mod.apply(this, { abc: "def", ghi: true, num: 1 }); mod.apply(this, { "abc": getTag(this, "#abc") })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            abc: 'def',
                            ghi: true,
                            num: 1,
                        },
                    }),
                ]);
            });

            it('should send a onMod() event to the affected file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
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
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
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
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': `let m = { abc: true }; mod.apply(m, { def: 123 }); mod.apply(this, m);`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            abc: true,
                            def: 123,
                        },
                    }),
                ]);
            });
        });

        describe('addToContextDiff()', () => {
            it('should add the file to the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.addToContext("abc"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
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
            it('should remove the file from the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: true,
                            'test()':
                                'mod.apply(this, mod.removeFromContext("abc"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
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
            it('should return a diff that sets the file position in a context when applied', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.setPosition("abc", 1, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            'abc.x': 1,
                            'abc.y': 2,
                        },
                    }),
                ]);
            });

            it('should ignore components that are not defined', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.setPosition("abc", undefined, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            'abc.y': 2,
                        },
                    }),
                ]);
            });

            it('should be able to set the index', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.setPosition("abc", undefined, undefined, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            'abc.sortOrder': 2,
                        },
                    }),
                ]);
            });
        });

        describe('getUserMenuContext()', () => {
            it('should return the aux._userMenuContext tag from the user file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#context", player.getMenuContext())',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._userMenuContext': 'abc',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'test',
                    ['thisFile', 'userFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            context: 'abc',
                        },
                    }),
                ]);
            });
        });

        describe('toast()', () => {
            it('should emit a ShowToastEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.toast("hello, world!")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([toast('hello, world!')]);
            });
        });

        describe('tweenTo()', () => {
            it('should emit a TweenToEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.tweenTo("test")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([tweenTo('test')]);
            });

            it('should handle files', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.tweenTo(this)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([tweenTo('thisFile')]);
            });
        });

        describe('openQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.openQRCodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openQRCodeScanner(true)]);
            });
        });

        describe('closeQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.closeQRCodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openQRCodeScanner(false)]);
            });
        });

        describe('showQRCode()', () => {
            it('should emit a ShowQRCodeEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.showQRCode("hello")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showQRCode(true, 'hello')]);
            });
        });

        describe('hideQRCode()', () => {
            it('should emit a ShowQRCodeEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.hideQRCode()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showQRCode(false)]);
            });
        });

        describe('openBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.openBarcodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openBarcodeScanner(true)]);
            });
        });

        describe('closeBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.closeBarcodeScanner()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openBarcodeScanner(false)]);
            });
        });

        describe('showBarcode()', () => {
            it('should emit a ShowBarcodeEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.showBarcode("hello")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showBarcode(true, 'hello')]);
            });

            it('should include the given format', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.showBarcode("hello", "format")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showBarcode(true, 'hello', <any>'format'),
                ]);
            });
        });

        describe('hideBarcode()', () => {
            it('should emit a ShowBarcodeEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.hideBarcode()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showBarcode(false)]);
            });
        });

        describe('loadChannel()', () => {
            it('should emit a LoadSimulationEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.loadChannel("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([loadSimulation('abc')]);
            });
        });

        describe('unloadChannel()', () => {
            it('should emit a UnloadSimulationEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.unloadChannel("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([unloadSimulation('abc')]);
            });
        });

        describe('loadAUX()', () => {
            it('should emit a ImportdAUXEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.importAUX("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([importAUX('abc')]);
            });
        });

        describe('isConnected()', () => {
            it('should get the aux.connected property from the current user file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#fun", player.isConnected())',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux.connected': true,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            fun: true,
                        },
                    }),
                ]);
            });

            it('should default to false when there is no user', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#fun", player.isConnected())',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            fun: false,
                        },
                    }),
                ]);
            });

            it('should default to false', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#fun", player.isConnected())',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            fun: false,
                        },
                    }),
                ]);
            });
        });

        describe('player.isInContext()', () => {
            it('should return true when aux._userContext equals the given value', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#inContext", player.isInContext("context"))',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._userContext': 'context',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            inContext: true,
                        },
                    }),
                ]);
            });

            it('should return false when aux._userContext does not equal the given value', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#inContext", player.isInContext("abc"))',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._userContext': 'context',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            inContext: false,
                        },
                    }),
                ]);
            });

            it('should return false when aux._userContext is not set', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#inContext", player.isInContext("abc"))',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            inContext: false,
                        },
                    }),
                ]);
            });
        });

        describe('player.currentContext()', () => {
            it('should return aux._userContext', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#context", player.currentContext())',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._userContext': 'context',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            context: 'context',
                        },
                    }),
                ]);
            });

            it('should return undefined when aux._userContext is not set', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#context", player.currentContext())',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {},
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            context: undefined,
                        },
                    }),
                ]);
            });
        });

        describe('player.isDesigner()', () => {
            it('should return true when the player is apart of the global file builder list', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
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
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._user': 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            isBuilder: true,
                        },
                    }),
                ]);
            });

            it('should return false when the player is not apart of the global file builder list', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
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
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._user': 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            isBuilder: false,
                        },
                    }),
                ]);
            });

            it('should return true when there are no designers', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#isBuilder", player.isDesigner())',
                        },
                    },
                    config: {
                        id: 'config',
                        tags: {},
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._user': 'bob',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            isBuilder: true,
                        },
                    }),
                ]);
            });
        });

        describe('player.showInputForTag()', () => {
            it('should emit a ShowInputForTagEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.showInputForTag(this, "abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showInputForTag('thisFile', 'abc'),
                ]);
            });

            it('should support passing a file ID', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.showInputForTag("test", "abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showInputForTag('test', 'abc')]);
            });

            it('should trim the first hash from the tag', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'player.showInputForTag("test", "##abc"); player.showInputForTag("test", "#abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showInputForTag('test', '#abc'),
                    showInputForTag('test', 'abc'),
                ]);
            });

            it('should support extra options', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'player.showInputForTag("test", "abc", { backgroundColor: "red", foregroundColor: "green" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
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
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.goToContext("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToContext('abc')]);
            });

            it('should ignore extra parameters', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.goToContext("sim", "abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToContext('sim')]);
            });
        });

        describe('player.goToURL()', () => {
            it('should issue a GoToURL event', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.goToURL("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToURL('abc')]);
            });
        });

        describe('player.openURL()', () => {
            it('should issue a OpenURL event', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.openURL("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openURL('abc')]);
            });
        });

        describe('player.openDevConsole()', () => {
            it('should issue a OpenConsole event', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.openDevConsole()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([openConsole()]);
            });
        });

        describe('mod.export()', () => {
            it('should serialize the given object to JSON', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#json", mod.export({ abc: "def" }))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            json: '{"abc":"def"}',
                        },
                    }),
                ]);
            });
        });

        describe('mod.import()', () => {
            it('should create a diff that applies the given tags from the given file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.import(getBot("#name", "bob"), "val", /test\\..+/))',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
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
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
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
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.import(getBots("name", "bob").first()))',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
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
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
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
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'mod.apply(this, mod.import({abc: true, val: 123}, "val"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            val: 123,
                        },
                    }),
                ]);
            });

            it('should create a diff from JSON', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': `mod.apply(this, mod.import('{"abc": true, "val": 123}', "val"))`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            val: 123,
                        },
                    }),
                ]);
            });
        });

        describe('setTag()', () => {
            it('should issue a file update for the given tag', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'setTag(this, "#name", "bob")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            name: 'bob',
                        },
                    }),
                ]);
            });

            it('should issue a file update for the given tag on multiple bots', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'setTag(this, "#name", "bob")',
                        },
                    },

                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            'test()': 'setTag(getBots("id"), "#name", "bob")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thatFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thatFile', {
                        tags: {
                            name: 'bob',
                        },
                    }),

                    fileUpdated('thisFile', {
                        tags: {
                            name: 'bob',
                        },
                    }),
                ]);
            });

            it('should make future getTag() calls use the set value', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'setTag(this, "#name", "bob"); setTag(this, "#abc", getTag(this, "#name"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            name: 'bob',
                            abc: 'bob',
                        },
                    }),
                ]);
            });
        });

        describe('server.echo()', () => {
            it('should send a EchoEvent in a RemoteEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'server.echo("message")',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'test',
                    ['thisFile', 'userFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(echo('message'))]);
            });
        });

        describe('server.sayHello()', () => {
            it('should send a SayHelloEvent in a RemoteEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'server.sayHello()',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'test',
                    ['thisFile', 'userFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(sayHello())]);
            });
        });

        describe('server.grantRole()', () => {
            it('should send a GrantRoleEvent in a RemoteEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'server.grantRole("abc", "def")',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'test',
                    ['thisFile', 'userFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(grantRole('abc', 'def')),
                ]);
            });
        });

        describe('server.revokeRole()', () => {
            it('should send a RevokeRoleEvent in a RemoteEvent', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'server.revokeRole("abc", "def")',
                        },
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            'aux._user': 'testUser',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action(
                    'test',
                    ['thisFile', 'userFile'],
                    'userFile'
                );
                const result = calculateActionEvents(
                    state,
                    fileAction,
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
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'server.shell("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(shell('abc'))]);
            });
        });

        describe('server.backupToGithub()', () => {
            it('should emit a remote backup to github event', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'server.backupToGithub("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(backupToGithub('abc'))]);
            });
        });

        describe('server.backupAsDownload()', () => {
            it('should emit a remote backup as download event', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'server.backupAsDownload()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const result = calculateActionEvents(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(backupAsDownload())]);
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
                const state: FilesState = {
                    userFile: {
                        id: 'userFile',
                        tags: {},
                    },
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': `="return ${val}"`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const [events, results] = calculateActionResults(
                    state,
                    fileAction,
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

                const state: FilesState = {
                    userFile: {
                        id: 'userFile',
                        tags: {},
                    },
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': `=${val}`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], 'userFile');
                const [events, results] = calculateActionResults(
                    state,
                    fileAction,
                    createSandbox
                );

                expect(events).toEqual([]);
                expect(results).toEqual([]);
            }
        );

        it('should return the result of the formula', () => {
            const state: FilesState = {
                userFile: {
                    id: 'userFile',
                    tags: {},
                },
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'test()': 'return 10',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('test', ['thisFile'], 'userFile');
            const [events, results] = calculateActionResults(
                state,
                fileAction,
                createSandbox
            );

            expect(results).toEqual([10]);
            expect(events).toEqual([]);
        });
    });

    describe('calculateDestroyFileEvents()', () => {
        it('should return a list of events needed to destroy the given file', () => {
            const file1 = createFile('file1');
            const file2 = createFile('file2', {
                'aux.creator': 'file1',
            });
            const file3 = createFile('file3', {
                'aux.creator': 'file2',
            });
            const file4 = createFile('file4', {
                'aux.creator': 'file1',
            });
            const file5 = createFile('file5');

            const calc = createCalculationContext(
                [file1, file2, file3, file4, file5],
                undefined,
                undefined,
                createSandbox
            );
            const events = calculateDestroyFileEvents(calc, file1);

            expect(events).toEqual([
                fileRemoved('file1'),
                fileRemoved('file2'),
                fileRemoved('file3'),
                fileRemoved('file4'),
            ]);
        });

        it('should not return a destroy event for files that are not destroyable', () => {
            const file1 = createFile('file1');
            const file2 = createFile('file2', {
                'aux.creator': 'file1',
                'aux.destroyable': false,
            });
            const file3 = createFile('file3', {
                'aux.creator': 'file2',
            });
            const file4 = createFile('file4', {
                'aux.creator': 'file1',
            });
            const file5 = createFile('file5');

            const calc = createCalculationContext(
                [file1, file2, file3, file4, file5],
                undefined,
                undefined,
                createSandbox
            );
            const events = calculateDestroyFileEvents(calc, file1);

            expect(events).toEqual([
                fileRemoved('file1'),
                // file2 and file3 are not destroyed because they are not destroyable
                fileRemoved('file4'),
            ]);
        });
    });

    describe('calculateFormulaEvents()', () => {
        it('should return the list of events that the formula produced', () => {
            const state: FilesState = {};

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
                fileAdded({
                    id: 'uuid-0',
                    tags: {
                        name: 'bob',
                    },
                }),
            ]);
        });

        it('should support updating files', () => {
            const state: FilesState = {
                otherFile: {
                    id: 'otherFile',
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
                fileUpdated('otherFile', {
                    tags: {
                        test: true,
                    },
                }),
            ]);
        });

        it('should use the given user id', () => {
            const state: FilesState = {
                userFile: {
                    id: 'userFile',
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
                'userFile',
                undefined,
                createSandbox
            );

            expect(result).toEqual([
                fileAdded({
                    id: 'uuid-0',
                    tags: {
                        test: true,
                    },
                }),
            ]);
        });
    });

    describe('getFilesForAction()', () => {
        it('should return the list of files sorted by ID', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {},
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {},
                },
            };

            const fileAction = action('test', ['thisFile', 'thatFile']);
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined,
                createSandbox
            );
            const { files } = getFilesForAction(state, fileAction, calc);

            expect(files).toEqual([state['thatFile'], state['thisFile']]);
        });

        it('should not sort IDs if the action specifies not to', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {},
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {},
                },
            };

            const fileAction = action(
                'test',
                ['thisFile', 'thatFile'],
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
            const { files } = getFilesForAction(state, fileAction, calc);

            expect(files).toEqual([state['thisFile'], state['thatFile']]);
        });
    });
}
