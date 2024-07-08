import { applyUpdate, Doc, Map as YMap } from 'yjs';
import { fromByteArray, toByteArray } from 'base64-js';
import {
    createYjsPartition,
    YjsPartition,
    YjsPartitionImpl,
} from '@casual-simulation/aux-common/partitions';
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
            const partition = new YjsPartitionImpl({
                type: 'yjs',
            });
            partition.connect();

            let values: any[] = [];

            for (let update of updates) {
                applyUpdate(partition.doc, update);

                await waitAsync();
                // const bot = partition.state['6e548e65-8f61-4f69-8fdf-bfae81b652a4'];

                const bot = partition.doc
                    .getMap('bots')
                    .get('6e548e65-8f61-4f69-8fdf-bfae81b652a4') as YMap<any>;

                values.push({
                    update: fromByteArray(update),
                    homeX: bot?.get('homeX'),
                    homeY: bot?.get('homeY'),
                });

                // values.push({
                //     update: fromByteArray(update),
                //     homeX: bot?.tags['homeX'],
                //     homeY: bot?.tags['homeY']
                // });
            }

            return values;
        }
    });

    // it.only('should properly handle out-of-order updates', async () => {
    //     const updates = [
    //         'AQHa9b2ACwWo2vW9gAsEAX1eAdr1vYALAQQB',
    //         'AQHa9b2ACwao2vW9gAsCAX10Adr1vYALAQIB',
    //         'AQHa9b2ACweo2vW9gAsFAX1fAdr1vYALAQUB',
    //         'AQHa9b2ACwio2vW9gAsHAX1gAdr1vYALAQcB',
    //         'AQHa9b2ACwmo2vW9gAsIAX1hAdr1vYALAQgB',
    //         'AQHa9b2ACwqo2vW9gAsGAX11Adr1vYALAQYB',
    //         'AQHa9b2ACwuo2vW9gAsJAX1iAdr1vYALAQkB',
    //         'AQHa9b2ACwyo2vW9gAsLAX1jAdr1vYALAQsB',
    //         'AQHa9b2ACw2o2vW9gAsKAX12Adr1vYALAQoB',
    //         'AQHa9b2ACw6o2vW9gAsMAX1kAdr1vYALAQwB',
    //     ];

    //     const outOfOrder = [
    //         'AQHa9b2ACwao2vW9gAsCAX10Adr1vYALAQIB',
    //         'AQHa9b2ACwqo2vW9gAsGAX11Adr1vYALAQYB',
    //         'AQHa9b2ACwWo2vW9gAsEAX1eAdr1vYALAQQB',
    //         'AQHa9b2ACwio2vW9gAsHAX1gAdr1vYALAQcB',
    //         'AQHa9b2ACwuo2vW9gAsJAX1iAdr1vYALAQkB',
    //         'AQHa9b2ACwmo2vW9gAsIAX1hAdr1vYALAQgB',
    //         'AQHa9b2ACw6o2vW9gAsMAX1kAdr1vYALAQwB',
    //         'AQHa9b2ACweo2vW9gAsFAX1fAdr1vYALAQUB',
    //         'AQHa9b2ACw2o2vW9gAsKAX12Adr1vYALAQoB',
    //         'AQHa9b2ACwyo2vW9gAsLAX1jAdr1vYALAQsB',
    //     ];

    //     const doc = new Doc();

    //     for(let update of updates) {
    //         applyUpdate(doc, toByteArray(update));
    //     }

    //     const bots = doc.getMap('bots');
    //     console.log([...bots.keys()]);
    //     const bot = bots.get('7c993deb-65dd-4fa5-967d-11f2510fd3f1') as YMap<any>;
    //     expect(bot?.get('homeX')).toBe(-54);
    //     expect(bot?.get('homeY')).toBe(-36);
    // });
});
