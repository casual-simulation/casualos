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
import { testDocumentImplementation } from './test/DocumentTests';
import { YjsSharedDocument } from './YjsSharedDocument';

console.log = jest.fn();

describe('YjsSharedDocument', () => {
    testDocumentImplementation(async () => {
        return new YjsSharedDocument({
            branch: 'testBranch',
        });
    });

    it('should be able to properly reload sub documents from arrays', async () => {
        const first = new YjsSharedDocument({
            branch: 'testBranch',
        });

        const firstArr = first.getArray('items');
        const firstMap = first.createMap();
        const firstText = first.createText();
        firstMap.set('value', 42);
        firstText.insert(0, 'Hello, world!');
        firstArr.push(firstMap);
        firstArr.push(firstText);

        const update = first.getStateUpdate();

        const second = new YjsSharedDocument({
            branch: 'otherBranch',
        });
        await second.applyStateUpdates([update]);

        const secondArr = second.getArray('items');
        expect(secondArr.length).toBe(2);
        const secondMap = secondArr.get(0);
        expect(secondMap.get('value')).toBe(42);
        const secondText = secondArr.get(1);
        expect(secondText.toString()).toBe('Hello, world!');
    });

    it('should be able to properly reload sub documents from maps', async () => {
        const first = new YjsSharedDocument({
            branch: 'testBranch',
        });

        const firstMap = first.getMap('map');
        const firstArr = first.createArray();
        const firstText = first.createText();
        firstText.insert(0, 'Hello, world!');
        firstArr.push(42);
        firstMap.set('array', firstArr);
        firstMap.set('text', firstText);

        const update = first.getStateUpdate();

        const second = new YjsSharedDocument({
            branch: 'otherBranch',
        });
        await second.applyStateUpdates([update]);

        const secondMap = second.getMap('map');
        const secondArray = secondMap.get('array');
        expect(secondArray.length).toBe(1);
        expect(secondArray.get(0)).toBe(42);
        const secondText = secondMap.get('text');
        expect(secondText.toString()).toBe('Hello, world!');
    });

    // function setupPartition(config: SharedDocumentConfig) {
    //     document = new RemoteYjsSharedDocument(
    //         client,
    //         authSource,
    //         config
    //     );

    //     sub.add(document);
    //     sub.add(document.onError.subscribe((e) => errors.push(e)));
    //     sub.add(
    //         document.onVersionUpdated.subscribe((v) => (version = v))
    //     );
    // }
});
