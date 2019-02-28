import { CausalTreeFactory } from "causal-trees";
import { AuxCausalTree } from "index";

/**
 * Creates a new Causal Tree Factory that can create all the tree types required for AUX applications.
 */
export function auxCausalTreeFactory() {
    return new CausalTreeFactory({
        'aux': (tree: any) => new AuxCausalTree(tree)
    });
}