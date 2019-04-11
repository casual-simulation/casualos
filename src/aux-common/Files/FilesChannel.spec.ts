import {
    fileAdded,
    FilesState,
    fileRemoved,
    action,
    calculateActionEvents,
    transaction,
    fileUpdated,
    calculateDestroyFileEvents,
} from './FilesChannel';
import { Workspace, Object, File } from './File';
import { values, assign, merge } from 'lodash';
import uuid from 'uuid/v4';
import { objectsAtContextGridPosition, calculateStateDiff, COMBINE_ACTION_NAME, createFile, createCalculationContext } from './FileCalculations';
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
                        'onCombine(#name:"Joe")': 'clone(this);destroy(this);destroy(that);',
                        'onCombine(#name:"Friend")': 'clone(this, { bad: true })',
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
                        'onCombine(#name:"Joe")': 'clone(this);destroy(this);destroy(that);',
                        'onCombine(#name:"Friend")': 'clone(this, { bad: true })',

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
                        'onCombine(#name:"Friend")': 'clone(this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
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
                        'onCombine(#name:"Friend")': 'clone(this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
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
                            'context': true
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
                            'context': null
                        }
                    })
                ]);
            });
        });

        describe('createMenuItem()', () => {
            it('should add a new file that is in the current users context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()': 'createMenuItem("id", "label", "action")',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('addItem', ['thisFile', 'userFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux._parent': 'userFile',
                            'aux.label': 'label',
                            'onClick()': 'action',
                            'context.id': 'id',
                            'context.index': 0,
                            'context': true
                        }
                    })
                ]);
            });

            it('should use the given data', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()': 'createMenuItem("id", "label", "action", { "aux.color": "blue" })',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('addItem', ['thisFile', 'userFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux._parent': 'userFile',
                            'aux.label': 'label',
                            'onClick()': 'action',
                            'context.id': 'id',
                            'context.index': 0,
                            'context': true,
                            'aux.color': 'blue'
                        }
                    })
                ]);
            });
        });

        describe('createMenuItemFrom()', () => {
            it('should add a new file that is in the current users context', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'addItem()': 'createMenuItemFrom(@name("test"), "id", "label", "action")',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    },
                    otherFile: {
                        id: 'otherFile',
                        tags: {
                            name: 'test'
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('addItem', ['thisFile', 'userFile'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileAdded({
                        id: 'uuid-0',
                        tags: {
                            'aux._parent': 'otherFile',
                            'aux.label': 'label',
                            'onClick()': 'action',
                            'context.id': 'id',
                            'context.index': 0,
                            'context': true
                        }
                    })
                ]);
            });
        });

        describe('destroyMenuItem()', () => {
            it('should delete the file with the given context.id', () => {
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        tags: {
                            'removeItem()': 'destroyMenuItem("test")',
                        }
                    },
                    userFile: {
                        id: 'userFile',
                        tags: {
                            _userMenuContext: 'context'
                        }
                    },
                    menuItem: {
                        id: 'menuItem',
                        tags: {
                            context: 0,
                            'context.id': 'test',
                        }
                    }
                };
    
                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const fileAction = action('removeItem', ['thisFile', 'userFile', 'menuItem'], 'userFile');
                const result = calculateActionEvents(state, fileAction);
    
                expect(result.hasUserDefinedEvents).toBe(true);
                
                expect(result.events).toEqual([
                    fileRemoved('menuItem')
                ]);
            });
        });
    });

    describe('destroyAllMenuItems()', () => {
        it('should delete all files with the given context.id', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        'removeItem()': 'destroyAllMenuItems()',
                    }
                },
                userFile: {
                    id: 'userFile',
                    tags: {
                        _userMenuContext: 'context'
                    }
                },
                menuItem: {
                    id: 'menuItem',
                    tags: {
                        context: true,
                        'context.id': 'test',
                    }
                },
                menuItem2: {
                    id: 'menuItem2',
                    tags: {
                        context: true,
                        'context.id': 'test',
                    }
                }
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('removeItem', ['thisFile', 'userFile', 'menuItem', 'menuItem2'], 'userFile');
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            expect(result.events).toEqual([
                fileRemoved('menuItem'),
                fileRemoved('menuItem2')
            ]);
        });
    });
    
    describe('calculateDestroyFileEvents()', () => {
        it('should return a list of events needed to destroy the given file', () => {
            const file1 = createFile('file1');
            const file2 = createFile('file2', {
                'aux._parent': 'file1'
            });
            const file3 = createFile('file3', {
                'aux._parent': 'file2'
            });
            const file4 = createFile('file4', {
                'aux._parent': 'file1'
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