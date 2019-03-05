import { WorkerEvent, CalculateValue, ValueCalculated } from './WorkerEvents';
import { AuxReducer } from '@yeti-cgi/aux-common';
import { AtomOp, AtomReducer, Weave } from '@yeti-cgi/aux-common/causal-trees';

const ctx: Worker = self as any;
let reducers: {
    [type: string]: AtomReducer<AtomOp, any, any>
} = {};

ctx.onmessage = (msg) => {
    const e = msg.data as WorkerEvent;
    if (e.type === 'calculate') {
        const val = calculateValue(e);
        const msg: ValueCalculated = {
            type: 'value_calculated',
            id: e.id,
            value: val
        };
        ctx.postMessage(msg);
    }
};

function calculateValue(e: CalculateValue): any {
    let reducer = reducers[e.treeType];
    if(!reducer) {
        if (e.treeType === 'aux') {
            reducer = new AuxReducer();
            reducers[e.treeType] = reducer;
        }
    }

    let weave = new Weave<AtomOp>();
    weave.import(e.weave);
    return reducer.eval(weave);
}

export interface WebpackWorker {
    new (): Worker;
}

export default (<any>null) as WebpackWorker;