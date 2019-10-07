import {
    storedTree,
    site,
    atom,
    atomId,
} from '@casual-simulation/causal-trees';
import { getAtomBot } from './AuxTreeCalculations';
import { AuxCausalTree } from './AuxCausalTree';
import { bot, tag } from './AuxAtoms';

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

        it('should return null if the given atom does not have a cause', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            const missing = atom(atomId(1, 99), atomId(1, 98), tag('abc'));

            const result = getAtomBot(tree.weave, missing);
            expect(result).toBe(null);
        });

        it('should return null if given null', async () => {
            let tree = new AuxCausalTree(storedTree(site(1)));
            const result = getAtomBot(tree.weave, null);
            expect(result).toBe(null);
        });
    });
});
