import Benchmark from 'benchmark';
import { Weave } from '../core2/Weave2';
import { atom, atomId } from '../core2/Atom2';

let insertSuite = new Benchmark.Suite('Weave2#insert');

insertSuite.add('append 1000 atoms', async function(deferred: any) {
    let weave = new Weave();

    let root = atom(atomId('a', 0), null, { type: 1 });
    weave.insert(root);
    for (let i = 0; i < 1000; i++) {
        weave.insert(atom(atomId('a', i), root, { type: 1 }));
    }
});

insertSuite.add('nest 1000 atoms', async function(deferred: any) {
    let weave = new Weave();

    let last = atom(atomId('a', 0), null, { type: 1 });
    weave.insert(last);
    for (let i = 0; i < 1000; i++) {
        const next = atom(atomId('a', i), last, { type: 1 });
        weave.insert(next);
        last = next;
    }
});

export default [insertSuite];
