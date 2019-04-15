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
} from './FilesChannel';
import { Workspace, Object, File } from './File';
import { values, assign, merge } from 'lodash';
import uuid from 'uuid/v4';
import { objectsAtContextGridPosition, calculateStateDiff, COMBINE_ACTION_NAME, createFile, createCalculationContext } from './FileCalculations';
import { TestConnector } from '../channels-core/test/TestConnector';
import { Subject } from 'rxjs';
import { ChannelClient, StoreFactory, ReducingStateStore } from '../channels-core';
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
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'onCombine(#name:"Joe")': 'clone(null, this);destroy(this);destroy(that);',
                        'onCombine(#name:"Friend")': 'clone(null, this, { bad: true })',
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe'
                    }
                }
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action(COMBINE_ACTION_NAME, ['thisFile', 'thatFile']);
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'onCombine(#name:"Joe")': 'clone(null, this);destroy(this);destroy(that);',
                        'onCombine(#name:"Friend")': 'clone(null, this, { bad: true })',

                        // the new file is not destroyed
                    }
                }),
                fileRemoved('thisFile'),
                fileRemoved('thatFile')
            ]);
        });

        it('should preserve formulas when copying', () => {
            
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        'onCombine(#name:"Friend")': 'clone(null, this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        name: 'Friend'
                    }
                }
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action(COMBINE_ACTION_NAME, ['thisFile', 'thatFile']);
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        'onCombine(#name:"Friend")': 'clone(null, this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
                        name: 'Friend',
                        testFormula: '=this.name'

                        // the new file is not destroyed
                    }
                }),
                fileRemoved('thisFile'),
                fileRemoved('thatFile')
            ]);
        });

        it('should not destroy the files when running a non combine event', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef(#name:"Joe")': 'clone(null, this)'
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe'
                    }
                }
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
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef(#name:"Joe")': 'clone(null, this)'
                    }
                })
            ]);
        });

        it('should run actions when no filter is provided', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()': 'clone(null, this)'
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe'
                    }
                }
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
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()': 'clone(null, this)'
                    }
                })
            ]);
        });

        it('should calculate events from setting property values', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()': 'this.val = 10; this.nested.value = true'
                    }
                }
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
                        'nested.value': true
                    }
                })
            ]);
        });

        it('should be able to set property values on files returned from queries', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'abcdef()': '@name("test").abc = "def"'
                    }
                },
                editFile: {
                    id: 'editFile',
                    tags: {
                        name: 'test'
                    }
                }
            };

            // specify the UUID to use next
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileUpdated('editFile', {
                    tags: {
                        abc: 'def'
                    }
                })
            ]);
        });

        it('should be able to set property values on files returned from other formulas', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'formula': '=@name("test")', 
                        'abcdef()': 'this.formula.abc = "def"'
                    }
                },
                editFile: {
                    id: 'editFile',
                    tags: {
                        name: 'test'
                    }
                }
            };

            // specify the UUID to use next
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileUpdated('editFile', {
                    tags: {
                        abc: 'def'
                    }
                })
            ]);
        });

        it('should be able to increment values on files returned from other formulas', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'formula': '=@name("test")', 
                        'abcdef()': 'this.formula.num += 1; this.formula.num += 1'
                    }
                },
                editFile: {
                    id: 'editFile',
                    tags: {
                        name: 'test',
                        num: 1
                    }
                }
            };

            // specify the UUID to use next
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileUpdated('editFile', {
                    tags: {
                        num: 3
                    }
                })
            ]);
        });

        it('should handle shouts', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef()': 'shout("sayHello")',
                        'sayHello()': 'this.hello = true'
                    }
                }
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('abcdef', ['thisFile']);
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileUpdated('thisFile', {
                    tags: {
                        hello: true
                    }
                })
            ]);
        });

        it('should preserve the user ID in shouts', () => {
            const state: FilesState = {
                userFile: {
                    id: 'userFile',
                    tags: {}
                },
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'abcdef()': 'shout("sayHello")',
                        'sayHello()': 'this.userId = getUser().id'
                    }
                }
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('abcdef', ['thisFile'], 'userFile');
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileUpdated('thisFile', {
                    tags: {
                        userId: 'userFile'
                    }
                })
            ]);
        });

        describe('create()', () => {
            it('should create a new file with aux._creator set to the original id', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'create(this, { abc: "def" })',
                        }
                    }
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
                            'aux._creator': 'thisFile'
                        }
                    })
                ]);
            });

            it('should create a new file with aux._creator set to the given id', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'create("thisFile", { abc: "def" })',
                        }
                    }
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
                            'aux._creator': 'thisFile'
                        }
                    })
                ]);
            });

            it('should support multiple arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'create("thisFile", { abc: "def" }, { ghi: 123 })',
                        }
                    }
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
                            'aux._creator': 'thisFile'
                        }
                    })
                ]);
            });

            it('should support files as arguments', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'create("thisFile", @name("that"))',
                        }
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            name: 'that',
                            abc: 'def',
                            formula: '=this.abc'
                        }
                    }
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
                            'aux._creator': 'thisFile'
                        }
                    })
                ]);
            });

            it('should return the created file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.newFileId = create(null, { abc: "def" }).id',
                        }
                    }
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
                            abc: 'def'
                        }
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            newFileId: 'uuid-0'
                        }
                    })
                ]);
            });

            it('should support modifying the returned file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'let newFile = create(null, { abc: "def" }); newFile.fun = true; newFile.num = 123;',
                        }
                    }
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
                            abc: 'def'
                        }
                    }),
                    fileUpdated('uuid-0', {
                        tags: {
                            fun: true,
                            num: 123
                        }
                    })
                ]);
            });

            it('should add the new file to the formulas', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'create(null, { name: "bob" }); this.fileId = @name("bob").id',
                        }
                    }
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
                            name: 'bob'
                        }
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            fileId: 'uuid-0'
                        }
                    })
                ]);
            });

            it('should support formulas on the new file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'let newFile = create(null, { formula: "=this.num", num: 100 }); this.result = newFile.formula;',
                        }
                    }
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
                            num: 100
                        }
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            result: 100
                        }
                    })
                ]);
            });

            it('should clean proxy objects', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            num: 100,
                            'test()': 'let newFile = create(this, { abc: this.num });',
                        }
                    }
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
                            abc: 100
                        }
                    })
                ]);

                const event = result.events[0] as FileAddedEvent;
                const parent = event.file.tags['aux._creator'] as any;
                const abc = event.file.tags['abc'] as any;
                expect(parent[isProxy]).toBeFalsy();
                expect(abc[isProxy]).toBeFalsy();
            });
        });

        describe('clone()', () => {
            it('should create a new file with aux._creator set to the given files ID', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'clone(this, { abc: "def" })',
                        }
                    }
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
                            'test()': 'clone(this, { abc: "def" })',
                            'aux._creator': 'thisFile'
                        }
                    })
                ]);
            });

            it('should return the created file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.newFileId = clone(null, this, { abc: "def" }).id',
                        }
                    }
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
                            'test()': 'this.newFileId = clone(null, this, { abc: "def" }).id',
                            abc: 'def'
                        }
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            newFileId: 'uuid-0'
                        }
                    })
                ]);
            });

            it('should support modifying the returned file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'let newFile = clone(null, this, { abc: "def" }); newFile.fun = true; newFile.num = 123;',
                        }
                    }
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
                            'test()': 'let newFile = clone(null, this, { abc: "def" }); newFile.fun = true; newFile.num = 123;',
                            abc: 'def'
                        }
                    }),
                    fileUpdated('uuid-0', {
                        tags: {
                            fun: true,
                            num: 123
                        }
                    })
                ]);
            });

            it('should add the new file to formulas', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'clone(null, this, { name: "bob" }); this.fileId = @name("bob").id',
                        }
                    }
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
                            'test()': 'clone(null, this, { name: "bob" }); this.fileId = @name("bob").id',
                            name: 'bob'
                        }
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            fileId: 'uuid-0'
                        }
                    })
                ]);
            });

            it('should support formulas on the new file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'let newFile = clone(null, this, { formula: "=this.num", num: 100 }); this.result = newFile.formula;',
                        }
                    }
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
                            'test()': 'let newFile = clone(null, this, { formula: "=this.num", num: 100 }); this.result = newFile.formula;',
                            num: 100,
                            formula: '=this.num'
                        }
                    }),
                    fileUpdated('thisFile', {
                        tags: {
                            result: 100
                        }
                    })
                ]);
            });

            it('should support using files for the creator', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'let newFile = clone(this, this, { formula: "=this.num", num: 100 });',
                        }
                    }
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
                            'test()': 'let newFile = clone(this, this, { formula: "=this.num", num: 100 });',
                            num: 100,
                            formula: '=this.num'
                        }
                    })
                ]);
            });

            it('should clean proxy objects', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            num: 100,
                            'test()': 'let newFile = clone(this, this, { abc: this.num });',
                        }
                    }
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
                            'test()': 'let newFile = clone(this, this, { abc: this.num });',
                            abc: 100,
                            num: 100
                        }
                    })
                ]);

                const event = result.events[0] as FileAddedEvent;
                const parent = event.file.tags['aux._creator'] as any;
                const abc = event.file.tags['abc'] as any;
                expect(parent[isProxy]).toBeFalsy();
                expect(abc[isProxy]).toBeFalsy();
            });
        });

        describe('destroy()', () => {
            it('should destroy and files that have aux._creator set to the file ID', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'destroy(this)',
                        }
                    },
                    childFile: {
                        id: 'childFile',
                        tags: {
                            'aux._creator': 'thisFile'
                        }
                    }
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
                        }
                    },
                    childFile: {
                        id: 'childFile',
                        tags: {
                            'aux._creator': 'thisFile'
                        }
                    },
                    childChildFile: {
                        id: 'childChildFile',
                        tags: {
                            'aux._creator': 'childFile'
                        }
                    },
                    otherChildFile: {
                        id: 'otherChildFile',
                        tags: {
                            'aux._creator': 'thisFile'
                        }
                    },
                    otherChildChildFile: {
                        id: 'otherChildChildFile',
                        tags: {
                            'aux._creator': 'otherChildFile'
                        }
                    }
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
        });

        describe('getUser()', () => {
            it('should get the current users file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'getUser().name = "Test"',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {}
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile', 'userFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('userFile', {
                        tags: {
                            name: 'Test'
                        }
                    })
                ]);
            });
        });

        describe('addToMenu()', () => {
            it('should add the given file to the users menu', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()': 'addToMenu(@name("bob"))',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    },
                    menuFile: {
                        id: 'menuFile',
                        tags: {
                            name: 'bob'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('addItem', ['thisFile', 'userFile', 'menuFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
                        tags: {
                            'context.id': 'uuid-0',
                            'context.index': 0,
                            'context': true,
                            'context.x': 0,
                            'context.y': 0
                        }
                    })
                ]);
            });
        });

        describe('addToMenuDiff()', () => {
            it('should add the given file to the users menu', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()': 'applyDiff(@name("bob"), makeDiff.addToMenu())',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    },
                    menuFile: {
                        id: 'menuFile',
                        tags: {
                            name: 'bob'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('addItem', ['thisFile', 'userFile', 'menuFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
                        tags: {
                            'context.id': 'uuid-0',
                            'context.index': 0,
                            'context': true,
                            'context.x': 0,
                            'context.y': 0
                        }
                    })
                ]);
            });
        });

        describe('removeFromMenu()', () => {
            it('should add the given file to the users menu', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'removeItem()': 'removeFromMenu(@name("bob"))', 
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    },
                    menuFile: {
                        id: 'menuFile',
                        tags: {
                            name: 'bob',
                            'context': 0,
                            'context.id': 'abcdef'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('removeItem', ['thisFile', 'userFile', 'menuFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
                        tags: {
                            'context.id': null,
                            'context.index': null,
                            'context': null,
                            'context.x': null,
                            'context.y': null
                        }
                    })
                ]);
            });
        });

        describe('removeFromMenuDiff()', () => {
            it('should remove the given file from the users menu', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()': 'applyDiff(@name("bob"), makeDiff.removeFromMenu())',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    },
                    menuFile: {
                        id: 'menuFile',
                        tags: {
                            name: 'bob',
                            'context': 0,
                            'context.id': 'abcdef'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('addItem', ['thisFile', 'userFile', 'menuFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('menuFile', {
                        tags: {
                            'context.id': null,
                            'context.index': null,
                            'context': null,
                            'context.x': null,
                            'context.y': null
                        }
                    })
                ]);
            });
        });

        describe('applyDiff()', () => {
            it('should update the given file with the given diff', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'applyDiff(this, { abc: "def", ghi: true, num: 1 })',
                        }
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
                            abc: "def",
                            ghi: true,
                            num: 1
                        }
                    })
                ]);
            });

            it('should support multiple', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'applyDiff(this, { abc: "def", ghi: true, num: 1 }, { abc: "xyz" });',
                        }
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
                            abc: "xyz",
                            ghi: true,
                            num: 1
                        }
                    })
                ]);
            });

            it('should apply the values to the file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'abc': 123,
                            'test()': 'applyDiff(this, { abc: "def", ghi: true, num: 1 }); applyDiff(this, { "abc": this.abc })',
                        }
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
                            abc: "def",
                            ghi: true,
                            num: 1
                        }
                    })
                ]);
            });
        });

        describe('addToContext()', () => {
            it('should add the file to the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'addToContext(this, "abc")',
                        }
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
                            'abc': true,
                            'abc.x': 0,
                            'abc.y': 0,
                            'abc.index': 0
                        }
                    })
                ]);
            });
        });

        describe('removeFromContext()', () => {
            it('should add the file to the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'abc': true,
                            'test()': 'removeFromContext(this, "abc")',
                        }
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
                            'abc': null,
                            'abc.x': null,
                            'abc.y': null,
                            'abc.index': null
                        }
                    })
                ]);
            });
        });

        describe('addToContextDiff()', () => {
            it('should add the file to the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'applyDiff(this, makeDiff.addToContext("abc"))',
                        }
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
                            'abc': true,
                            'abc.x': 0,
                            'abc.y': 0,
                            'abc.index': 0
                        }
                    })
                ]);
            });
        });

        describe('removeFromContextDiff()', () => {
            it('should remove the file from the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'abc': true,
                            'test()': 'applyDiff(this, makeDiff.removeFromContext("abc"))',
                        }
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
                            'abc': null,
                            'abc.x': null,
                            'abc.y': null,
                            'abc.index': null
                        }
                    })
                ]);
            });
        });

        describe('getFilesInContext()', () => {
            it('should return the list of files that are in the given context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'abc': true,
                            'test()': 'this.length = getFilesInContext("abc").length',
                        }
                    },
                    thatFile: {
                        id: 'thatFile',
                        tags: {
                            'abc': true
                        }
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
                            'length': 2
                        }
                    })
                ]);
            });

            it('should always return a list', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'abc': true,
                            'test()': 'this.length = getFilesInContext("abc").length',
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            'length': 1
                        }
                    })
                ]);
            });
        });

        describe('setPositionDiff()', () => {
            it('should return a diff that sets the file position in a context when applied', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'applyDiff(this, makeDiff.setPosition("abc", 1, 2))',
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            "abc.x": 1,
                            "abc.y": 2
                        }
                    })
                ]);
            });

            it('should ignore components that are not defined', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'applyDiff(this, makeDiff.setPosition("abc", undefined, 2))',
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            "abc.y": 2
                        }
                    })
                ]);
            });

            it('should be able to set the index', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'applyDiff(this, makeDiff.setPosition("abc", undefined, undefined, 2))',
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile']);
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            "abc.index": 2
                        }
                    })
                ]);
            });
        });

        describe('getUserMenuContext()', () => {
            it('should return the _userMenuContext tag from the user file', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'this.context = getUserMenuContext()',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'abc'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('test', ['thisFile', 'userFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileUpdated('thisFile', {
                        tags: {
                            context: 'abc'
                        }
                    })
                ]);
            });
        });
    });
    
    describe('calculateDestroyFileEvents()', () => {
        it('should return a list of events needed to destroy the given file', () => {
            const file1 = createFile('file1');
            const file2 = createFile('file2', {
                'aux._creator': 'file1'
            });
            const file3 = createFile('file3', {
                'aux._creator': 'file2'
            });
            const file4 = createFile('file4', { 
                'aux._creator': 'file1'
            });
            const file5 = createFile('file5');

            const calc = createCalculationContext([file1, file2, file3, file4, file5]);
            const events = calculateDestroyFileEvents(calc, file1);

            expect(events).toEqual([
                fileRemoved('file1'),
                fileRemoved('file2'),
                fileRemoved('file3'),
                fileRemoved('file4')
            ]);
        });
    });
});