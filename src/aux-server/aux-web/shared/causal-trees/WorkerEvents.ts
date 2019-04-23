import { AtomOp, Atom } from '@casual-simulation/causal-trees';

export type WorkerEvent = CalculateValue | ValueCalculated;

export interface CalculateValue {
    type: 'calculate';
    id: string;
    weave: Atom<AtomOp>[];
    treeType: string;
}

export interface ValueCalculated {
    type: 'value_calculated';
    id: string;
    value: any;
}
