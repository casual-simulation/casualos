/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Map as YMap } from 'yjs';
import { Doc } from 'yjs';
import { fromByteArray, toByteArray } from 'base64-js';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { applyUpdatesInOrder } from '@casual-simulation/aux-common/yjs/YjsHelpers';
import { readFile } from 'fs/promises';
import path from 'path';

describe('Yjs out-of-order updates', () => {
    it('should handle out-of-order updates', async () => {
        const sentUpdatesPath = path.resolve(__dirname, './sent_updates.txt');
        const recievedUpdatesPath = path.resolve(
            __dirname,
            './recieved_updates.txt'
        );

        const sentUpdates = await readUpdates(sentUpdatesPath);
        const recievedUpdates = await readUpdates(recievedUpdatesPath);

        const sentValues = await getValues(sentUpdates);
        const recievedValues = await getValues(recievedUpdates);

        // In-order updates should apply normally.
        expect(sentValues[sentValues.length - 1].homeX).toBe(-7);
        expect(sentValues[sentValues.length - 1].homeY).toBe(4);

        // Out-of-order updates should not produce invalid intermediate states.
        let lastKnownGood: { homeX?: number; homeY?: number } = {};
        for (let value of recievedValues) {
            if (
                value.homeX === undefined &&
                lastKnownGood.homeX !== undefined
            ) {
                throw new Error(
                    `homeX was deleted while waiting for missing updates (last known good: ${JSON.stringify(
                        lastKnownGood
                    )})`
                );
            }
            if (
                value.homeY === undefined &&
                lastKnownGood.homeY !== undefined
            ) {
                throw new Error(
                    `homeY was deleted while waiting for missing updates (last known good: ${JSON.stringify(
                        lastKnownGood
                    )})`
                );
            }

            if (hasValue(value.homeX) && hasValue(value.homeY)) {
                const sentMatch = sentValues.find(
                    (s) => s.homeX === value.homeX && s.homeY === value.homeY
                );
                expect(sentMatch).toBeTruthy();
                lastKnownGood = { homeX: value.homeX, homeY: value.homeY };
            } else {
                if (hasValue(value.homeX)) {
                    lastKnownGood.homeX = value.homeX;
                }
                if (hasValue(value.homeY)) {
                    lastKnownGood.homeY = value.homeY;
                }
            }
        }

        async function readUpdates(filePath: string) {
            return parseUpdates(await readFile(filePath, 'utf-8'));
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
            let pendingUpdates: Uint8Array[] = [];

            for (let update of updates) {
                pendingUpdates = applyUpdatesInOrder(
                    doc,
                    [update],
                    undefined,
                    pendingUpdates
                );

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

        function hasValue(value: any) {
            return value !== null && value !== undefined;
        }
    });

    it('should reproduce yjs issue #461 with misordered map updates', () => {
        const a = new Doc();
        const b = new Doc();
        let pendingUpdates: Uint8Array[] = [];

        let updateEnabled = true;
        a.on('update', (update) => {
            if (updateEnabled) {
                pendingUpdates = applyUpdatesInOrder(
                    b,
                    [update],
                    undefined,
                    pendingUpdates
                );
            }
        });

        const aMap = a.getMap('map');
        const bMap = b.getMap('map');
        aMap.set('x', 0);
        aMap.set('y', 0);

        expect(bMap.toJSON()).toEqual({ x: 0, y: 0 });

        updateEnabled = false;
        aMap.set('x', 100);

        updateEnabled = true;
        aMap.set('y', 200);

        // y should not disappear while waiting for the missing x update
        expect(bMap.toJSON()).toEqual({ x: 0, y: 0 });
    });
});
