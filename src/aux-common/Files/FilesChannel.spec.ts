import {
    fileAdded,
    FilesState,
    fileRemoved,
    action,
    calculateActionEvents,
    transaction,
    fileUpdated,
} from './FilesChannel';
import { Workspace, Object, File } from './File';
import { values, assign, merge } from 'lodash';
import uuid from 'uuid/v4';
import { objectsAtContextGridPosition, calculateStateDiff } from './FileCalculations';
import { TestConnector } from '../channels-core/test/TestConnector';
import { Subject } from 'rxjs';
import { ChannelClient, StoreFactory, ReducingStateStore } from '../channels-core';

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
                        '+(#name:"Joe")': 'clone(this);destroy(this);destroy(that);',
                        '+(#name:"Friend")': 'clone(this, { bad: true })',
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
            const fileAction = action('+', ['thisFile', 'thatFile']);
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        '+(#name:"Joe")': 'clone(this);destroy(this);destroy(that);',
                        '+(#name:"Friend")': 'clone(this, { bad: true })',

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
                        '+(#name:"Friend")': 'clone(this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
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
            const fileAction = action('+', ['thisFile', 'thatFile']);
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
                        '+(#name:"Friend")': 'clone(this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
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
                        'abcdef(#name:"Joe")': 'clone(this)'
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
                        'abcdef(#name:"Joe")': 'clone(this)'
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
                        'abcdef()': 'clone(this)'
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
                        'abcdef()': 'clone(this)'
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

        describe('createFrom()', () => {
            it('should create a new file with aux._parent set to the original id', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'createFrom(this, { abc: "def" })',
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
                            'aux._parent': 'thisFile'
                        }
                    })
                ]);
            });

            it('should create a new file with aux._parent set to the given id', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'createFrom("thisFile", { abc: "def" })',
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
                            'aux._parent': 'thisFile'
                        }
                    })
                ]);
            });
        });

        describe('cloneFrom()', () => {
            it('should create a new file with aux._parent set to the given files ID', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'test()': 'cloneFrom(this, { abc: "def" })',
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
                            'test()': 'cloneFrom(this, { abc: "def" })',
                            'aux._parent': 'thisFile'
                        }
                    })
                ]);
            });
        });

        describe('destroy()', () => {
            it('should destroy and files that have aux._parent set to the file ID', () => {
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
                            'aux._parent': 'thisFile'
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

            it('should recursively destroy files that have aux._parent set to the file ID', () => {
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
                            'aux._parent': 'thisFile'
                        }
                    },
                    childChildFile: {
                        id: 'childChildFile',
                        tags: {
                            'aux._parent': 'childFile'
                        }
                    },
                    otherChildFile: {
                        id: 'otherChildFile',
                        tags: {
                            'aux._parent': 'thisFile'
                        }
                    },
                    otherChildChildFile: {
                        id: 'otherChildChildFile',
                        tags: {
                            'aux._parent': 'otherChildFile'
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
    });

});