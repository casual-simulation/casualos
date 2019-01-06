import { filesReducer, fileAdded, FilesState, fileRemoved, action } from './FilesChannel';
import { Workspace, Object } from './File';
import { values } from 'lodash';
import uuid from 'uuid/v4';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('FilesChannel', () => {
    describe('filesReducer()', () => {
        describe('file_added', () => {
            it('should add the given file to the state', () => {
                const file: Workspace = {
                    id: 'test',
                    type: 'workspace',
                    position: { x: 1, y: 2, z: 3 },
                    size: 10
                };
                const state = {};
                const newState = filesReducer(state, fileAdded(file));

                expect(newState).toEqual({
                    test: file
                });
            });
        });

        describe('file_removed', () => {
            it('should remove the given file from the state', () => {
                const state: FilesState = {
                    test: {
                        id: 'test',
                        type: 'workspace',
                        position: { x: 1, y: 2, z: 3 },
                        size: 10
                    }
                };
                const newState = filesReducer(state, fileRemoved('test'));

                expect(newState).toEqual({});
            });
        });

        describe('action', () => {

            it('should run scripts on the this file and then execute the resulting actions', () => {
                
                const state: FilesState = {
                    thisFile: {
                        id: 'thisFile',
                        type: 'object',
                        tags: {
                            _position: { x:0, y: 0, z: 0 },
                            _workspace: 'abc',
                            '+(#name:"Joe")': 'copy(this)',
                            '+(#name:"Friend")': 'copy(this, { bad: true })',
                        }
                    },
                    thatFile: {
                        id: 'thatFile',
                        type: 'object',
                        tags: {
                            _position: { x:0, y: 0, z: 0 },
                            _workspace: 'def',
                            name: 'Joe'
                        }
                    }
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const newState = filesReducer(state, action('thisFile', 'thatFile', '+'));

                expect(newState).toEqual({
                    // should create a new value from "thisFile"
                    'uuid-0': {
                        id: 'uuid-0',
                        type: 'object',
                        tags: {
                            _position: { x:0, y: 0, z: 0 },
                            _workspace: 'abc',
                            '+(#name:"Joe")': 'copy(this)',
                            '+(#name:"Friend")': 'copy(this, { bad: true })',

                            // the new file is not destroyed
                        }
                    },
                    thisFile: {
                        id: 'thisFile',
                        type: 'object',
                        tags: {
                            _position: { x:0, y: 0, z: 0 },
                            _workspace: 'abc',
                            '+(#name:"Joe")': 'copy(this)',
                            '+(#name:"Friend")': 'copy(this, { bad: true })',

                            // The original files should be destroyed by default.
                            _destroyed: true,
                        }
                    },
                    thatFile: {
                        id: 'thatFile',
                        type: 'object',
                        tags: {
                            _position: { x:0, y: 0, z: 0 },
                            _workspace: 'def',
                            _destroyed: true,
                            name: 'Joe'
                        }
                    }
                });
            });
        });
    });
});