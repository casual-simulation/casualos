import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, Doc, Map as YMap } from 'yjs';

export function getUpdates(
    func: (doc: Doc, bots: YMap<YMap<any>>) => void,
    doc: Doc = new Doc()
): string[] {
    const bots = doc.getMap('bots') as YMap<YMap<any>>;
    let update: Uint8Array;
    doc.on('update', (u: Uint8Array) => {
        update = u;
    });
    doc.transact(() => {
        func(doc, bots);
    });

    return [fromByteArray(update)];
}

export function createDocFromUpdates(messageUpdates: any[]) {
    const doc = new Doc();
    for (let update of messageUpdates) {
        applyUpdate(doc, toByteArray(update));
    }

    return doc;
}
