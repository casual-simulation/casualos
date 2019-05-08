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
                        'abcdef()': '@name("test").abc = "def"',
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
                        formula: '=@name("test")',
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
                        formula: '=@name("test")',
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
                    fileUpdated('thisFile', {
                        tags: {
                            hello: true,
                        },
                    }),
                    fileUpdated('otherFile', {
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
                            'abcdef()': 'shout("sayHello", @name("other"))',
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
                            'abcdef()': 'shout("sayHello", @name("other"))',
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
                                'let o = { other: @name("other") }; shout("sayHello", o)',
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
                                'shout("sayHello", @name("other")); this.value = @name("other").hello',
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
                    fileUpdated('thisFile', {
                        tags: {
                            value: 'test',
                        },
                    }),
                    fileUpdated('otherFile', {
                        tags: {
                            hello: 'test',
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
        });

        describe('create()', () => {
            it('should create a new file with aux._creator set to the original id', () => {
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
                            'aux._creator': 'thisFile',
                        },
                    }),
                ]);
            });

            it('should create a new file with aux._creator set to the given id', () => {
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
                            'aux._creator': 'thisFile',
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
                            'aux._creator': 'thisFile',
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
                            'aux._creator': 'thisFile',
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
                                'create(null, { name: "bob" }); this.fileId = @name("bob").id',
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
                            'aux._creator': 'thisFile',
                            abc: 100,
                        },
                    }),
                ]);

                const event = result.events[0] as FileAddedEvent;
                const parent = event.file.tags['aux._creator'] as any;
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
                            'aux._creator': 'thisFile',
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
                            'aux._creator': 'thisFile',
                            hello: true,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux._creator': 'thisFile',
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
                            'aux._creator': 'thisFile',
                            hello: true,
                            wow: 1,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux._creator': 'thisFile',
                            hello: false,
                            wow: 1,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-2',
                        tags: {
                            'aux._creator': 'thisFile',
                            hello: true,
                            oh: 'haha',
                        },
                    }),
                    fileAdded({
                        id: 'uuid-3',
                        tags: {
                            'aux._creator': 'thisFile',
                            hello: false,
                            oh: 'haha',
                        },
                    }),
                    fileAdded({
                        id: 'uuid-4',
                        tags: {
                            'aux._creator': 'thisFile',
                            hello: true,
                            test: 'a',
                        },
                    }),
                    fileAdded({
                        id: 'uuid-5',
                        tags: {
                            'aux._creator': 'thisFile',
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
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            test: true,
                            hello: true,
                        },
                    },
                    otherFile: {
                        id: 'otherFile',
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
                            'aux._creator': 'thisFile',
                            test: true,
                            hello: true,
                        },
                    }),
                    fileAdded({
                        id: 'uuid-1',
                        tags: {
                            'aux._creator': 'thisFile',
                            test: true,
                            hello: false,
                        },
                    }),
                ]);
            });
        });

        describe('destroy()', () => {
            it('should destroy and files that have aux._creator set to the file ID', () => {
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
                            'aux._creator': 'thisFile',
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

            it('should recursively destroy files that have aux._creator set to the file ID', () => {
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
                            'aux._creator': 'thisFile',
                        },
                    },
                    childChildFile: {
                        id: 'childChildFile',
                        tags: {
                            'aux._creator': 'childFile',
                        },
                    },
                    otherChildFile: {
                        id: 'otherChildFile',
                        tags: {
                            'aux._creator': 'thisFile',
                        },
                    },
                    otherChildChildFile: {
                        id: 'otherChildChildFile',
                        tags: {
                            'aux._creator': 'otherChildFile',
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
                            'onDestroy()': '@name("other").num = 100',
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
                                'applyDiff(@name("bob"), diff.addToMenu())',
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
                                'applyDiff(@name("bob"), diff.removeFromMenu())',
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

        describe('applyDiff()', () => {
            it('should update the given file with the given diff', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'applyDiff(this, { abc: "def", ghi: true, num: 1 })',
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
                                'applyDiff(this, { abc: "def", ghi: true, num: 1 }, { abc: "xyz" });',
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
                                'applyDiff(this, { abc: "def", ghi: true, num: 1 }); applyDiff(this, { "abc": this.abc })',
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
        });

        describe('addToContextDiff()', () => {
            it('should add the file to the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'applyDiff(this, diff.addToContext("abc"))',
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
                                'applyDiff(this, diff.removeFromContext("abc"))',
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

        describe('setPositionDiff()', () => {
            it('should return a diff that sets the file position in a context when applied', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()':
                                'applyDiff(this, diff.setPosition("abc", 1, 2))',
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
                                'applyDiff(this, diff.setPosition("abc", undefined, 2))',
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
                                'applyDiff(this, diff.setPosition("abc", undefined, undefined, 2))',
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
    });

    describe('calculateDestroyFileEvents()', () => {
        it('should return a list of events needed to destroy the given file', () => {
            const file1 = createFile('file1');
            const file2 = createFile('file2', {
                'aux._creator': 'file1',
            });
            const file3 = createFile('file3', {
                'aux._creator': 'file2',
            });
            const file4 = createFile('file4', {
                'aux._creator': 'file1',
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
    });
});
