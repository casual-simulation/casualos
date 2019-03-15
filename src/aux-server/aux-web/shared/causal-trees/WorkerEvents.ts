import { AtomOp, RealtimeChannelInfo, WeaveReference } from "@yeti-cgi/aux-common/causal-trees";

export type WorkerEvent = CalculateValue | ValueCalculated;

export interface CalculateValue {
    type: 'calculate';
    id: string;
    weave: WeaveReference<AtomOp>[];
    treeType: string;
}

export interface ValueCalculated {
    type: 'value_calculated';
    id: string;
    value: any;
}