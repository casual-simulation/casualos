import { AuxCausalTree, AuxObject } from "@casual-simulation/aux-common";
import { FileHelper } from "./FileHelper";
import { storedTree, site } from "@casual-simulation/aux-common/causal-trees";


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
            const {added: file1 } = await tree.file('test1');
            
            const { added: file2 } = await tree.file('test2');
            const { added: tag } = await tree.tag('_destroyed', file2);
            const { added: val } = await tree.val(true, tag);

            const objs = helper.objects;

            expect(objs).toEqual([
                tree.value['test1'],
                helper.userFile
            ]);
        });
    });

    // TODO: Add more tests
});