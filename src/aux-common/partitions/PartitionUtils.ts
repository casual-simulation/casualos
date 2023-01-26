import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate } from 'yjs';
import {
    botAdded,
    BotsState,
    createBot,
    CreateInitializationUpdateAction,
    GetInstStateFromUpdatesAction,
    InstUpdate,
} from '../bots';
import { YjsPartitionImpl } from './YjsPartition';

/**
 * Creates a new initialization update using the given action.
 */
export function constructInitializationUpdate(
    action: CreateInitializationUpdateAction
): InstUpdate {
    const partition = new YjsPartitionImpl({
        type: 'yjs',
    });

    let instUpdate: InstUpdate;
    partition.doc.on('update', (update: Uint8Array) => {
        instUpdate = {
            id: 0,
            timestamp: Date.now(),
            update: fromByteArray(update),
        };
    });

    partition.applyEvents(
        action.bots.map((b) => botAdded(createBot(b.id, b.tags)))
    );

    return instUpdate;
}

/**
 * Gets the bots state that is encoded from the given action.
 * @param action The action.
 */
export function getStateFromUpdates(
    action: GetInstStateFromUpdatesAction
): BotsState {
    let partition = new YjsPartitionImpl({
        type: 'yjs',
    });

    for (let { update } of action.updates) {
        const updateBytes = toByteArray(update);
        applyUpdate(partition.doc, updateBytes);
    }

    return partition.state;
}
