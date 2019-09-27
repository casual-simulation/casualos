import { FileWatcher, UpdatedFileInfo } from './FileWatcher';
import {
    createPrecalculatedBot,
    PrecalculatedBot,
    PrecalculatedBotsState,
} from '@casual-simulation/aux-common';
import { FileHelper } from './FileHelper';
import { TestAuxVM } from '../vm/test/TestAuxVM';

describe('FileWatcher', () => {
    let vm: TestAuxVM;
    let watcher: FileWatcher;
    let helper: FileHelper;

    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM();
        helper = new FileHelper(vm);
        helper.userId = userId;

        watcher = new FileWatcher(helper, vm.stateUpdated);
    });

    it('should update the file helper state', () => {
        const state = {
            user: createPrecalculatedBot('user'),
        };
        vm.sendState({
            state: state,
            addedFiles: [],
            updatedFiles: [],
            removedFiles: [],
        });

        expect(helper.filesState).toEqual(state);
    });

    it('should merge the new state with the current state', () => {
        vm.sendState({
            state: {
                user: createPrecalculatedBot('user'),
                file: createPrecalculatedBot('file'),
            },
            addedFiles: [],
            updatedFiles: [],
            removedFiles: [],
        });

        vm.sendState({
            state: {
                test: createPrecalculatedBot('test'),
                user: <PrecalculatedBot>(<Partial<PrecalculatedBot>>{
                    tags: {
                        abc: 'def',
                    },
                    values: {
                        abc: 'def',
                    },
                }),
                file: null,
            },
            addedFiles: [],
            updatedFiles: [],
            removedFiles: [],
        });

        expect(helper.filesState).toEqual({
            user: createPrecalculatedBot('user', {
                abc: 'def',
            }),
            test: createPrecalculatedBot('test'),
        });
    });

    describe('filesDiscovered', () => {
        it('should resolve with the added files', async () => {
            let files: PrecalculatedBot[] = [];
            watcher.filesDiscovered.subscribe(f => files.push(...f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: ['test', 'test2'],
                updatedFiles: [],
                removedFiles: [],
            });

            expect(files).toEqual([state['test'], state['test2']]);
        });

        it('should resolve with the current files immediately', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: ['test', 'test2'],
                updatedFiles: [],
                removedFiles: [],
            });

            let files: PrecalculatedBot[] = [];
            watcher.filesDiscovered.subscribe(f => files.push(...f));

            expect(files).toEqual([state['test'], state['test2']]);
        });

        it('should not start with files that were removed', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: ['test', 'test2'],
                updatedFiles: [],
                removedFiles: [],
            });

            state = Object.assign({}, state);
            state['test2'] = null;

            vm.sendState({
                state: state,
                addedFiles: [],
                updatedFiles: [],
                removedFiles: ['test2'],
            });

            let files: PrecalculatedBot[] = [];
            watcher.filesDiscovered.subscribe(f => files.push(...f));

            expect(files).toEqual([state['test']]);
        });
    });

    describe('filesRemoved', () => {
        it('should resolve with the removed file IDs', async () => {
            let files: string[] = [];
            watcher.filesRemoved.subscribe(f => files.push(...f));

            vm.sendState({
                state: {},
                addedFiles: [],
                updatedFiles: [],
                removedFiles: ['test', 'test2'],
            });

            expect(files).toEqual(['test', 'test2']);
        });
    });

    describe('filesUpdated', () => {
        it('should resolve with the updated files', async () => {
            let files: PrecalculatedBot[] = [];
            watcher.filesUpdated.subscribe(f => files.push(...f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: [],
                updatedFiles: ['test', 'test2'],
                removedFiles: [],
            });

            expect(files).toEqual([state['test'], state['test2']]);
        });

        it('should omit tags that are null', async () => {
            let files: PrecalculatedBot[] = [];
            watcher.filesUpdated.subscribe(f => files.push(...f));

            vm.sendState({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                },
                addedFiles: ['test'],
                updatedFiles: [],
                removedFiles: [],
            });

            let state: any = {
                test: {
                    tags: {
                        abc: null,
                    },
                    values: {
                        abc: null,
                    },
                },
            };
            vm.sendState({
                state: state,
                addedFiles: [],
                updatedFiles: ['test'],
                removedFiles: [],
            });

            expect(files).toEqual([createPrecalculatedBot('test')]);
        });
    });

    describe('fileChanged()', () => {
        it('should return an observable that only resolved when the given file changes', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: ['test', 'test2'],
                updatedFiles: [],
                removedFiles: [],
            });

            let files: PrecalculatedBot[] = [];
            watcher.fileChanged('test').subscribe(f => files.push(f));

            let secondState = {
                test: createPrecalculatedBot('test', { abc: 'def' }),
                test2: createPrecalculatedBot('test2', { ghi: 'jfk' }),
            };
            vm.sendState({
                state: secondState,
                addedFiles: [],
                updatedFiles: ['test', 'test2'],
                removedFiles: [],
            });

            expect(files).toEqual([state['test'], secondState['test']]);
        });

        it('should resolve with null if the given file ID is deleted', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: ['test', 'test2'],
                updatedFiles: [],
                removedFiles: [],
            });

            let files: PrecalculatedBot[] = [];
            watcher.fileChanged('test').subscribe(f => files.push(f));

            let secondState: PrecalculatedBotsState = {
                test: null,
            };
            vm.sendState({
                state: secondState,
                addedFiles: [],
                updatedFiles: ['test'],
                removedFiles: ['test'],
            });

            expect(files).toEqual([state['test'], null]);
        });
    });

    describe('botTagsChanged()', () => {
        it('should return an observable that resolves with the tags that changed on a file', async () => {
            let state = {
                test: createPrecalculatedBot('test', { test: 123 }),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: ['test', 'test2'],
                updatedFiles: [],
                removedFiles: [],
            });

            let files: UpdatedFileInfo[] = [];
            watcher.botTagsChanged('test').subscribe(f => files.push(f));

            let secondState = {
                test: createPrecalculatedBot('test', {
                    abc: 'def',
                    test: null,
                }),
                test2: createPrecalculatedBot('test2', { ghi: 'jfk' }),
            };
            vm.sendState({
                state: secondState,
                addedFiles: [],
                updatedFiles: ['test', 'test2'],
                removedFiles: [],
            });

            expect(files).toEqual([
                {
                    file: state['test'],
                    tags: new Set(),
                },
                {
                    file: createPrecalculatedBot('test', { abc: 'def' }),
                    tags: new Set(['abc', 'test']),
                },
            ]);
        });

        it('should resolve with null if the given file ID is deleted', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedFiles: ['test', 'test2'],
                updatedFiles: [],
                removedFiles: [],
            });

            let files: UpdatedFileInfo[] = [];
            watcher.botTagsChanged('test').subscribe(f => files.push(f));

            let secondState: PrecalculatedBotsState = {
                test: null,
            };
            vm.sendState({
                state: secondState,
                addedFiles: [],
                updatedFiles: ['test'],
                removedFiles: ['test'],
            });

            expect(files).toEqual([
                {
                    file: state['test'],
                    tags: new Set(),
                },
                null,
            ]);
        });
    });
});
