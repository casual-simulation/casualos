import { CausalTreeFactory } from '@casual-simulation/causal-trees';
import { AuxCausalTree } from './AuxCausalTree';

/**
 * Creates a new Causal Tree Factory that can create all the tree types required for AUX applications.
 */
export function auxCausalTreeFactory() {
    return new CausalTreeFactory({
        aux: (tree: any, options) => new AuxCausalTree(tree, options),
    });
}
