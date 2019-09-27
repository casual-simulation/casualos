import { storedTree, site } from '@casual-simulation/causal-trees';
import { getAtomBot } from './AuxTreeCalculations';
import { AuxCausalTree } from './AuxCausalTree';

describe('AuxTreeCalculations', () => {
    describe('getAtomBot()', () => {
        it('should get the bot that the given tag is under', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            const { added: bot } = await tree.bot('test');
            const { added: test } = await tree.tag('test', bot);
            const { added: val } = await tree.val('123', test);

            const result = getAtomBot(tree.weave, val);

            expect(result).toBe(bot);
        });

        it('should handle bot deletions', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const { added: root } = await tree.root();
            const { added: bot } = await tree.bot('test');
            const { added: del } = await tree.delete(bot);

            const result = getAtomBot(tree.weave, del);

            expect(result).toBe(bot);
        });

        it('should return null if it is not childed to a bot', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const { added: root } = await tree.root();
            const { added: bot } = await tree.bot('test');
            const { added: test } = await tree.tag('test', bot);
            const { added: val } = await tree.val('123', test);

            const result = getAtomBot(tree.weave, root);

            expect(result).toBe(null);
        });
    });
});
