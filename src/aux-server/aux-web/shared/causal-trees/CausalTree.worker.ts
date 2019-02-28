import io from 'socket.io-client';
import { GetTreeRequest, GetTreeResponse, WorkerEvent } from './WorkerEvents';
import { SocketIOConnection } from './SocketIOConnection';
import { auxCausalTreeFactory } from '@yeti-cgi/aux-common';
import { CausalTreeStore } from '@yeti-cgi/aux-common/causal-trees';

const ctx: Worker = self as any;
let trees: WorkerTreeMap = {};
let factory = auxCausalTreeFactory();
let store: CausalTreeStore;
let socket = io({});
socket.on('connect', () => {
    console.log('[SocketManager] Connected.');
});

socket.on('disconnect', () => {
    console.log('[SocketManger] Disconnected.');
});

ctx.onmessage = (msg) => {
    const e = msg.data as WorkerEvent;
    if (e.type === 'get_tree_req') {
        let tree = trees[e.id];
        if (!tree) {
            tree = new WorkerTree(e.type, e.id);
            trees[e.id] = tree;
        }

        const resp: GetTreeResponse = {
            type: 'get_tree_resp',
            id: e.id
        };
        ctx.postMessage(resp);
    }
};

/**
 * Defines a class that manages a single causal tree.
 */
class WorkerTree {
    constructor(type: string, id: string) {

    }
}

interface WorkerTreeMap {
    [key: string]: WorkerTree;
}