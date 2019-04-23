import {
    AuxCausalTree,
    AuxObject,
    FileEvent,
    LocalEvent,
} from '@casual-simulation/aux-common';
import { FileHelper } from './FileHelper';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('FileHelper', () => {
    let userId: string = 'user';
    let tree: AuxCausalTree;
    let helper: FileHelper;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new FileHelper(tree, userId);

        await tree.root();
        await tree.file('user');
    });

    describe('userFile', () => {
        it('should return the file that has the same ID as the user ID', async () => {
            const file = tree.value['user'];
            const user = helper.userFile;

            expect(user).toBe(file);
        });
    });

    describe('objects', () => {
        it('should return active objects', async () => {
            const { added: file1 } = await tree.file('test1');

            const { added: file2 } = await tree.file('test2');
            const { added: tag } = await tree.tag('_destroyed', file2);
            const { added: val } = await tree.val(true, tag);

            const objs = helper.objects;

            expect(objs).toEqual([
                tree.value['test2'],
                tree.value['test1'],
                helper.userFile,
            ]);
        });
    });

    describe('createContext()', () => {
        it('should define a library variable when in aux builder', () => {
            helper = new FileHelper(tree, userId, {
                isBuilder: true,
                isPlayer: false,
            });

            const context = helper.createContext();

            expect(context.sandbox.library.isBuilder).toBe(true);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });

        it('should define a library variable when in aux player', () => {
            helper = new FileHelper(tree, userId, {
                isBuilder: false,
                isPlayer: true,
            });

            const context = helper.createContext();

            expect(context.sandbox.library.isBuilder).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(true);
        });

        it('should default to not in aux builder or player', () => {
            helper = new FileHelper(tree, userId, {
                isBuilder: false,
                isPlayer: false,
            });

            const context = helper.createContext();

            expect(context.sandbox.library.isBuilder).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });
    });

    describe('localEvents', () => {
        it('should emit local events that are sent via transaction()', () => {
            let events: LocalEvent[] = [];
            helper.localEvents.subscribe(e => events.push(e));
        });
    });

    // TODO: Add more tests
});
