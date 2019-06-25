import { storedTree, site } from '@casual-simulation/causal-trees';
import { getAtomFile } from './AuxTreeCalculations';
import { AuxCausalTree } from './AuxCausalTree';

describe('AuxTreeCalculations', () => {
    describe('getAtomFile()', () => {
        it('should get the file that the given tag is under', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            const { added: file } = await tree.file('test');
            const { added: test } = await tree.tag('test', file);
            const { added: val } = await tree.val('123', test);

            const result = getAtomFile(tree.weave, val);

            expect(result).toBe(file);
        });

        it('should handle file deletions', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const { added: root } = await tree.root();
            const { added: file } = await tree.file('test');
            const { added: del } = await tree.delete(file);

            const result = getAtomFile(tree.weave, del);

            expect(result).toBe(file);
        });

        it('should return null if it is not childed to a file', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const { added: root } = await tree.root();
            const { added: file } = await tree.file('test');
            const { added: test } = await tree.tag('test', file);
            const { added: val } = await tree.val('123', test);

            const result = getAtomFile(tree.weave, root);

            expect(result).toBe(null);
        });
    });
});
