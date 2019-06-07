import {
    fileAdded,
    FilesState,
    fileRemoved,
    action,
    calculateActionEvents,
    transaction,
    fileUpdated,
    calculateDestroyFileEvents,
    FileAddedEvent,
    toast,
    tweenTo,
    openQRCodeScanner,
    loadSimulation,
    unloadSimulation,
    superShout,
    showQRCode,
    goToContext,
    calculateFormulaEvents,
    importAUX,
    showInputForTag,
} from './FilesChannel';
import { File } from './File';
import uuid from 'uuid/v4';
import {
    COMBINE_ACTION_NAME,
    createFile,
    createCalculationContext,
    calculateFileValue,
} from './FileCalculations';
import { isProxy } from './FileProxy';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('FilesChannel', () => {
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
            const result = calculateActionEvents(state, fileAction);

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
            const result = calculateActionEvents(state, fileAction);

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
            const result = calculateActionEvents(state, fileAction);

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
            const result = calculateActionEvents(state, fileAction);

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
                        'abcdef()': 'this.val = 10; this.nested.value = true',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(state, fileAction);

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
                        'abcdef()': '@name("test").first().abc = "def"',
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
            const result = calculateActionEvents(state, fileAction);

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
                        formula: '=@name("test").first()',
                        'abcdef()': 'this.formula.abc = "def"',
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
            const result = calculateActionEvents(state, fileAction);

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
                        formula: '=@name("test").first()',
                        'abcdef()':
                            'this.formula.num += 1; this.formula.num += 1',
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
            const result = calculateActionEvents(state, fileAction);

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
                        'sayHello()': 'this.userId = player.getFile().id',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('abcdef', ['thisFile'], 'userFile');
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                fileUpdated('thisFile', {
                    tags: {
                        userId: 'userFile',
                    },
                }),
            ]);
        });

        describe('arguments', () => {
            it('should convert the argument to a proxy object if it is a file', () => {
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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hi: 'test',
                        },
                    }),
                ]);
            });

            it('should convert the argument to a list of proxy objects if it is a list of files', () => {
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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hi: 'test',
                            l: 1,
                        },
                    }),
                ]);
            });

            it('should convert the argument fields to proxy objects if they are files', () => {
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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hi: 'test',
                        },
                    }),
                ]);
            });

            it('should convert nested fields to proxy objects', () => {
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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            hi: 'test',
                        },
                    }),
                ]);
            });

            it('should handle null arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.hi = "test"',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile'], null, null);
                const result = calculateActionEvents(state, fileAction);

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

        describe('shout()', () => {
            it('should run the event on every file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            'abcdef()': 'shout("sayHello")',
                            'sayHello()': 'this.hello = true',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            'sayHello()': 'this.hello = true',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                            'sayHello()': 'this.hello = that.hi',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'shout("sayHello", @name("other").first())',
                            'sayHello()': 'this.hello = that.hi',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'shout("sayHello", @name("other").first())',
                            'sayHello()': 'that.hello = "test"',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'let o = { other: @name("other").first() }; shout("sayHello", o)',
                            'sayHello()': 'that.other.hello = "test"',
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
                const result = calculateActionEvents(state, fileAction);

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
                            'sayHello()': 'this.hello = that',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'shout("sayHello", @name("other").first()); this.value = @name("other").first().hello',
                            'sayHello()': 'that.hello = "test"',
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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([superShout('sayHello')]);
            });
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
                            'sayHello()': 'this.hello = true',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            'sayHello()': 'this.hello = true',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                            'abcdef()': 'whisper(@hello, "sayHello")',
                        },
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            hello: true,
                            'sayHello()': 'this.saidHello = true',
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            hello: true,
                            'sayHello()': 'this.saidHello = true',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('abcdef', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
        });

        describe('tags.remove()', () => {
            it('remove the given tag sections on the fiven file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'create()':
                                'let newFile = create(this, { stay: "def" }, { "leave.x": 0 }, { "leave.y": 0 }); tags.remove(newFile, "leave");',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('create', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'create("thisFile", @name("that"))',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'this.newFileId = create(null, { abc: "def" }).id',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'let newFile = create(null, { abc: "def" }); newFile.fun = true; newFile.num = 123;',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'create(null, { name: "bob" }); this.fileId = @name("bob").first().id',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'let newFile = create(null, { formula: "=this.num", num: 100 }); this.result = newFile.formula;',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            formula: '=this.num',
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

            it('should clean proxy objects', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            num: 100,
                            'test()':
                                'let newFile = create(this, { abc: this.num });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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

                const event = result.events[0] as FileAddedEvent;
                const parent = event.file.tags['aux.creator'] as any;
                const abc = event.file.tags['abc'] as any;
                expect(parent[isProxy]).toBeFalsy();
                expect(abc[isProxy]).toBeFalsy();
            });

            it('should trigger onCreate() on the created file.', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            num: 1,
                            'test()':
                                'create(this, { abc: this.num, "onCreate()": "this.num = 100" });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux.creator': 'thisFile',
                            abc: 1,
                            'onCreate()': 'this.num = 100',
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
                                'this.num = create("thisFile", [ { hello: true }, { hello: false } ]).length',
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'this.num = create("thisFile", [ { hello: true }, { hello: false } ], [ { wow: 1 }, { oh: "haha" }, { test: "a" } ]).length',
                        },
                    },
                };

                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `uuid-${num++}`);
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'create("thisFile", @test(true))',
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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'destroy(@clone);',
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
                const result = calculateActionEvents(state, fileAction);

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
                            'onDestroy()': '@name("other").first().num = 100',
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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('otherFile', {
                        tags: {
                            num: 100,
                        },
                    }),
                    fileRemoved('thisFile'),
                ]);
            });

            it('should not destroy files that are not destroyable', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'destroy(this)',
                            'onDestroy()': '@abc("def").name = "bob"',
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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([fileRemoved('thisFile')]);
            });
        });

        describe('getUser()', () => {
            it('should get the current users file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'player.getFile().name = "Test"',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'tags.apply(@name("bob").first(), tags.addToMenu())',
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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
                        tags: {
                            'context.id': 'uuid-0',
                            'context.index': 0,
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
                                'tags.apply(@name("bob").first(), tags.removeFromMenu())',
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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
                        tags: {
                            'context.id': null,
                            'context.index': null,
                            context: null,
                            'context.x': null,
                            'context.y': null,
                        },
                    }),
                ]);
            });
        });

        describe('tags.apply()', () => {
            it('should update the given file with the given diff', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'tags.apply(this, { abc: "def", ghi: true, num: 1 })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'tags.apply(this, { abc: "def", ghi: true, num: 1 }, { abc: "xyz" });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'tags.apply(this, { abc: "def", ghi: true, num: 1 }); tags.apply(this, { "abc": this.abc })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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

            it('should send a onMerge() event to the affected file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: 123,
                            'onMerge()': 'this.diffed = true',
                            'test()':
                                'tags.apply(this, { abc: "def", ghi: true, num: 1 });',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            diffed: true,
                        },
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            abc: 'def',
                            ghi: true,
                            num: 1,
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
                                'tags.apply(this, tags.addToContext("abc"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            abc: true,
                            'abc.x': 0,
                            'abc.y': 0,
                            'abc.index': 0,
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
                                'tags.apply(this, tags.removeFromContext("abc"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            abc: null,
                            'abc.x': null,
                            'abc.y': null,
                            'abc.index': null,
                        },
                    }),
                ]);
            });
        });

        describe('getFilesInContext()', () => {
            it('should return the list of files that are in the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: true,
                            'test()':
                                'this.length = getFilesInContext("abc").length',
                        },
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            abc: true,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile', 'thatFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            length: 2,
                        },
                    }),
                ]);
            });

            it('should always return a list', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: true,
                            'test()':
                                'this.length = getFilesInContext("abc").length',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            length: 1,
                        },
                    }),
                ]);
            });
        });

        describe('getFilesInStack()', () => {
            it('should return the list of files that are in the same position as the given file in the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 2,
                            'abc.index': 2,
                            'test()':
                                'this.length = getFilesInStack(this, "abc").length',
                        },
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 2,
                            'abc.index': 1,
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 3,
                            'abc.index': 0,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            length: 2,
                        },
                    }),
                ]);
            });

            it('should sort the returned files by their index', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 2,
                            'abc.index': 2,
                            'test()':
                                'this.ids = getFilesInStack(this, "abc").map(f => f.id.valueOf())',
                        },
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 2,
                            'abc.index': 1,
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 2,
                            'abc.index': 3,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            ids: ['thatFile', 'thisFile', 'otherFile'],
                        },
                    }),
                ]);
            });
        });

        describe('getNeighboringFiles()', () => {
            const cases = [
                ['left', 1, 0],
                ['right', -1, 0],
                ['front', 0, -1],
                ['back', 0, 1],
            ];

            describe.each(cases)(
                '%s',
                (position: string, x: number, y: number) => {
                    it('should get the list of files in a stack next to the given file', () => {
                        const state: FilesState = {
                            thisFile: {
                                id: 'thisFile',
                                tags: {
                                    abc: true,
                                    'abc.x': 1,
                                    'abc.y': 2,
                                    'abc.index': 2,
                                    'test()': `this.ids = getNeighboringFiles(this, "abc", "${position}").map(f => f.id.valueOf())`,
                                },
                            },
                            sameStackFile: {
                                id: 'sameStackFile',
                                tags: {
                                    abc: true,
                                    'abc.y': 2,
                                    'abc.x': 1,
                                    'abc.index': 1,
                                },
                            },
                            thatFile: {
                                id: 'thatFile',
                                tags: {
                                    abc: true,
                                    'abc.x': 1 + x,
                                    'abc.y': 2 + y,
                                    'abc.index': 1,
                                },
                            },
                            otherFile: {
                                id: 'otherFile',
                                tags: {
                                    abc: true,
                                    'abc.x': 1 + x,
                                    'abc.y': 2 + y,
                                    'abc.index': 3,
                                },
                            },
                        };

                        // specify the UUID to use next
                        uuidMock.mockReturnValue('uuid-0');
                        const fileAction = action('test', ['thisFile']);
                        const result = calculateActionEvents(state, fileAction);

                        expect(result.hasUserDefinedEvents).toBe(true);

                        expect(result.events).toEqual([
                            fileUpdated('thisFile', {
                                tags: {
                                    ids: ['thatFile', 'otherFile'],
                                },
                            }),
                        ]);
                    });
                }
            );

            it('should return an object containing all of the neighboring stacks', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 2,
                            'abc.index': 2,
                            'test()': `let map = getNeighboringFiles(this, "abc");
                                 this.front = map.front.map(f => f.id.valueOf());
                                 this.back = map.back.map(f => f.id.valueOf());
                                 this.left = map.left.map(f => f.id.valueOf());
                                 this.right = map.right.map(f => f.id.valueOf());`,
                        },
                    },
                    sameStackFile: {
                        id: 'sameStackFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 2,
                            'abc.index': 1,
                        },
                    },
                    leftFile: {
                        id: 'leftFile',
                        tags: {
                            abc: true,
                            'abc.x': 2, // left
                            'abc.y': 2,
                            'abc.index': 1,
                        },
                    },
                    rightFile: {
                        id: 'rightFile',
                        tags: {
                            abc: true,
                            'abc.x': 0, // right
                            'abc.y': 2,
                            'abc.index': 3,
                        },
                    },
                    backFile: {
                        id: 'backFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 3, // back
                            'abc.index': 3,
                        },
                    },
                    frontFile: {
                        id: 'frontFile',
                        tags: {
                            abc: true,
                            'abc.x': 1,
                            'abc.y': 1, // front
                            'abc.index': 3,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            front: ['frontFile'],
                            back: ['backFile'],
                            left: ['leftFile'],
                            right: ['rightFile'],
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
                                'tags.apply(this, tags.setPosition("abc", 1, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'tags.apply(this, tags.setPosition("abc", undefined, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                                'tags.apply(this, tags.setPosition("abc", undefined, undefined, 2))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            'abc.index': 2,
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
                            'test()': 'this.context = player.getMenuContext()',
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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showQRCode(false)]);
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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'this.fun = player.isConnected()',
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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'this.fun = player.isConnected()',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'this.fun = player.isConnected()',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'this.inContext = player.isInContext("context")',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'this.inContext = player.isInContext("abc")',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'this.inContext = player.isInContext("abc")',
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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'this.context = player.currentContext()',
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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'this.context = player.currentContext()',
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
                const result = calculateActionEvents(state, fileAction);

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

        describe('player.isBuilder()', () => {
            it('should return true when the player is apart of the global file builder list', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.isBuilder = player.isBuilder()',
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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'this.isBuilder = player.isBuilder()',
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
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': 'this.isBuilder = player.isBuilder()',
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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showInputForTag('test', 'abc')]);
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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

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
                const result = calculateActionEvents(state, fileAction);

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToContext('sim')]);
            });
        });

        describe('tags.export()', () => {
            it('should serialize the given object to JSON', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.json = tags.export({ abc: "def" })',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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

        describe('tags.import()', () => {
            it('should create a diff that applies the given tags from the given file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'tags.apply(this, tags.import(@name("bob").first(), "val", /test\\..+/))',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'tags.apply(this, tags.import(@name("bob").first()))',
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
                const result = calculateActionEvents(state, fileAction);

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
                                'tags.apply(this, tags.import({abc: true, val: 123}, "val"))',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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
                            'test()': `tags.apply(this, tags.import('{"abc": true, "val": 123}', "val"))`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);

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

            const calc = createCalculationContext([
                file1,
                file2,
                file3,
                file4,
                file5,
            ]);
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

            const calc = createCalculationContext([
                file1,
                file2,
                file3,
                file4,
                file5,
            ]);
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
                'create(null, { name: "bob" })'
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
                '@name("bob").first().test = true'
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
                'create(null, player.getFile())',
                'userFile'
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

    describe('goToContext()', () => {
        it('should use the first parameter as the context if only one argument is provided', () => {
            const event = goToContext('context');

            expect(event).toEqual({
                type: 'local',
                name: 'go_to_context',
                context: 'context',
            });
        });

        it('should ignore all other parameters', () => {
            const event = (<any>goToContext)('context', 'abc');

            expect(event).toEqual({
                type: 'local',
                name: 'go_to_context',
                context: 'context',
            });
        });
    });
});
