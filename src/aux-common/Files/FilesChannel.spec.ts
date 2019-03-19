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
                        '+(#name:"Joe")': 'copy(this);destroy(this);destroy(that);',
                        '+(#name:"Friend")': 'copy(this, { bad: true })',
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
                        '+(#name:"Joe")': 'copy(this);destroy(this);destroy(that);',
                        '+(#name:"Friend")': 'copy(this, { bad: true })',

                        // the new file is not destroyed
                    }
                }),
                fileUpdated('thisFile', {
                    tags: {
                        _destroyed: true
                    }
                }),
                fileUpdated('thatFile', {
                    tags: {
                        _destroyed: true
                    }
                })
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
                        '+(#name:"Friend")': 'copy(this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
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
                        '+(#name:"Friend")': 'copy(this, that, { testFormula: "=this.name" });destroy(this);destroy(that);',
                        name: 'Friend',
                        testFormula: '=this.name'

                        // the new file is not destroyed
                    }
                }),
                fileUpdated('thisFile', {
                    tags: {
                        _destroyed: true
                    }
                }),
                fileUpdated('thatFile', {
                    tags: {
                        _destroyed: true
                    }
                })
            ]);
        });

        it('should not destroy the files when running a non combine event', () => {
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        'abcdef(#name:"Joe")': 'copy(this)'
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
                        'abcdef(#name:"Joe")': 'copy(this)'
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
                        'abcdef()': 'copy(this)'
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
                        'abcdef()': 'copy(this)'
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
    });

});