import { applyUpdate, Doc, Map as YMap } from 'yjs';
import { fromByteArray, toByteArray } from 'base64-js';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { readFile } from 'fs/promises';
import path from 'path';

describe('test', () => {
    it('should handle out-of-order updates', async () => {
        const sentUpdatesPath = path.resolve(__dirname, './sent_updates.txt');
        const recievedUpdatesPath = path.resolve(
            __dirname,
            './recieved_updates.txt'
        );

        console.log(sentUpdatesPath);

        const sentUpdates = await readUpdates(sentUpdatesPath);
        const recievedUpdates = await readUpdates(recievedUpdatesPath);

        const sentValues = await getValues(sentUpdates);
        console.log('sent:', sentValues);

        const recievedValues = await getValues(recievedUpdates);
        console.log('recieved:', recievedValues);

        async function readUpdates(path: string) {
            return parseUpdates(await readFile(path, 'utf-8'));
        }

        function parseUpdates(content: string) {
            const lines = content.split('\n');
            const updates: Uint8Array[] = [];
            for (let line of lines) {
                if (line.trim().length === 0) {
                    continue;
                }
                updates.push(toByteArray(line.trim()));
            }
            return updates;
        }

        async function getValues(updates: Uint8Array[]) {
            const doc = new Doc();
            let values: any[] = [];

            for (let update of updates) {
                applyUpdate(doc, update);

                await waitAsync();

                const bot = doc
                    .getMap('bots')
                    .get('6e548e65-8f61-4f69-8fdf-bfae81b652a4') as YMap<any>;

                values.push({
                    update: fromByteArray(update),
                    homeX: bot?.get('homeX'),
                    homeY: bot?.get('homeY'),
                });
            }

            return values;
        }
    });
});
