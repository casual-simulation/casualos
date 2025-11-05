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
import type { CurrentVersion, StatusUpdate } from '../../common';
import type {
    SharedArrayChanges,
    SharedDocument,
    SharedMapChanges,
} from '../SharedDocument';
import { Subscription } from 'rxjs';
import { waitAsync } from '../../test/TestHelpers';

/**
 * Tests the given document implementation for various features.
 */
export function testDocumentImplementation(
    createDocument: () => Promise<SharedDocument>
) {
    let document: SharedDocument;
    let statuses: StatusUpdate[];
    let version: CurrentVersion;
    let sub: Subscription;

    beforeEach(async () => {
        sub = new Subscription();
        document = await createDocument();

        statuses = [];

        sub.add(document.onVersionUpdated.subscribe((v) => (version = v)));
        sub.add(
            document.onStatusUpdated.subscribe((update) =>
                statuses.push(update)
            )
        );
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('getMap()', () => {
        it('should return a map', () => {
            expect(document.getMap('abc')).toBeTruthy();
        });

        it('should be able to get the same map multiple times', () => {
            const map1 = document.getMap('abc');
            const map2 = document.getMap('abc');

            expect(map1).toBe(map2);
        });

        it('should return different maps for different keys', () => {
            const map1 = document.getMap('abc');
            const map2 = document.getMap('def');

            expect(map1).not.toBe(map2);
        });

        it('should be able to store data in a map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');

            expect(map.get('hello')).toBe('world');
        });

        it('should be able delete keys in a map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.delete('hello');

            expect(map.has('hello')).toBe(false);
        });

        it('should be able list keys in a map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.set('test', 'value');

            expect([...map.keys()]).toEqual(['hello', 'test']);
        });

        it('should be able to list entries in a a map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.set('test', 'value');

            expect([...map.entries()]).toEqual([
                ['hello', 'world'],
                ['test', 'value'],
            ]);
        });

        it('should be able to list values in a map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.set('test', 'value');

            expect([...map.values()]).toEqual(['world', 'value']);
        });

        it('should be able to clear the map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.set('test', 'value');
            map.clear();

            expect([...map.keys()]).toEqual([]);
        });

        it('should be able to loop over the map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.set('test', 'value');

            const keys: string[] = [];
            const values: string[] = [];
            map.forEach((value, key) => {
                keys.push(key);
                values.push(value);
            });

            expect(keys).toEqual(['hello', 'test']);
            expect(values).toEqual(['world', 'value']);
        });

        it('should be able to iterate over the map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.set('test', 'value');

            const keys: string[] = [];
            const values: string[] = [];
            for (let [key, value] of map) {
                keys.push(key);
                values.push(value);
            }

            expect(keys).toEqual(['hello', 'test']);
            expect(values).toEqual(['world', 'value']);
        });

        it('should be able to get the document from a map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');

            expect(map.doc).toBe(document);
        });

        it('should return undefined if the map doesnt have a parent', () => {
            const map = document.getMap('abc');
            expect(map.parent).toBeUndefined();
        });

        it('should be able to set a map in a map', () => {
            const map1 = document.getMap('abc');
            const map2 = document.createMap();

            map2.set('hello', 'world');

            map1.set('map', map2);

            expect(map1.get('map')).toBe(map2);
            expect(map2.parent).toBe(map1);
            expect(map2.doc).toBe(document);

            expect(map1.toJSON()).toEqual({
                map: {
                    hello: 'world',
                },
            });
        });

        it('should be able to set an array in a map', () => {
            const map1 = document.getMap('abc');
            const array1 = document.createArray();

            array1.push('hello', 'world');

            map1.set('array', array1);

            expect(map1.get('array')).toBe(array1);
            expect(array1.parent).toBe(map1);
            expect(array1.doc).toBe(document);

            expect(map1.toJSON()).toEqual({
                array: ['hello', 'world'],
            });
        });

        it('should be able to set text in a map', () => {
            const map1 = document.getMap('abc');
            const text1 = document.createText();

            text1.insert(0, 'hello world');

            map1.set('text', text1);

            expect(map1.get('text')).toBe(text1);
            expect(text1.parent).toBe(map1);
            expect(text1.doc).toBe(document);

            expect(map1.toJSON()).toEqual({
                text: 'hello world',
            });
        });

        it('should throw an error if setting a top-level map inside another map', () => {
            const map1 = document.getMap('abc');
            const map2 = document.getMap('top');

            map2.set('hello', 'world');

            expect(() => {
                map1.set('map', map2);
            }).toThrow('Cannot set a top-level map inside another map.');
        });

        // TODO: Currently YJS doesn't seem to actually clone the map
        it.skip('should be able to clone a map', () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');
            map.set('test', 'value');

            const c = map.clone();

            expect([...c.keys()]).toEqual(['hello', 'test']);

            expect(c.toJSON()).toEqual({
                hello: 'world',
                test: 'value',
            });
        });

        it('should emit changes', async () => {
            const map = document.getMap('abc');
            let changes: SharedMapChanges<any>[] = [];

            sub.add(map.changes.subscribe((c) => changes.push(c)));

            map.set('hello', 'world');
            map.set('hello', 'different');
            map.delete('hello');

            await waitAsync();

            expect(changes.length).toBe(3);
            expect(changes[0].type).toBe('map');
            expect(changes[0].target === map).toBe(true);
            expect(changes[0].changes).toEqual(
                new Map([
                    [
                        'hello',
                        {
                            action: 'add',
                            oldValue: undefined,
                        },
                    ],
                ])
            );
            expect(changes[1].type).toBe('map');
            expect(changes[1].target === map).toBe(true);
            expect(changes[1].changes).toEqual(
                new Map([
                    [
                        'hello',
                        {
                            action: 'update',
                            oldValue: 'world',
                        },
                    ],
                ])
            );
            expect(changes[2].type).toBe('map');
            expect(changes[2].target === map).toBe(true);
            expect(changes[2].changes).toEqual(
                new Map([
                    [
                        'hello',
                        {
                            action: 'delete',
                            oldValue: 'different',
                        },
                    ],
                ])
            );
        });
    });

    describe('getArray()', () => {
        it('should return an array', () => {
            expect(document.getArray('abc')).toBeTruthy();
        });

        it('should be able to get the same array multiple times', () => {
            const array1 = document.getArray('abc');
            const array2 = document.getArray('abc');

            expect(array1).toBe(array2);
        });

        it('should return different arrays for different keys', () => {
            const map1 = document.getArray('abc');
            const map2 = document.getArray('def');

            expect(map1).not.toBe(map2);
        });

        it('should be able to store data in an array', () => {
            const array = document.getArray('abc');
            array.push('hello');

            expect(array.toArray()).toEqual(['hello']);
        });

        it('should be able to push multiple items at once', () => {
            const array = document.getArray('abc');
            array.push('hello', 'world');

            expect(array.toArray()).toEqual(['hello', 'world']);
        });

        it('should be able to delete items in an array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.delete(0, 1);

            expect(array.toArray()).toEqual([]);
        });

        it('should be able to pop items from the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');
            expect(array.pop()).toBe('world');
            expect(array.toArray()).toEqual(['hello']);
        });

        it('should be able to add items to the beginning of the array', () => {
            const array = document.getArray('abc');
            array.push('world');
            array.unshift('hello');
            expect(array.toArray()).toEqual(['hello', 'world']);
        });

        it('should be able to shift items from the beginning of the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');
            expect(array.shift()).toBe('hello');
            expect(array.toArray()).toEqual(['world']);
        });

        it('should be able to unshift items onto the beginning of the array', () => {
            const array = document.getArray('abc');
            array.unshift('hello');
            array.unshift('world');
            expect(array.toArray()).toEqual(['world', 'hello']);
        });

        it('should be able to use splice to delete items from the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');
            array.push('123');
            array.push('456');

            const deleted = array.splice(2, 2);
            expect(deleted).toEqual(['123', '456']);
            expect(array.toArray()).toEqual(['hello', 'world']);
        });

        it('should be able to use splice with negative start to delete items from end of the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');
            array.push('123');
            array.push('456');

            const deleted = array.splice(-2, 2);
            expect(deleted).toEqual(['123', '456']);
            expect(array.toArray()).toEqual(['hello', 'world']);
        });

        it('should be able to use splice to insert items in the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');
            array.push('123');
            array.push('456');

            const deleted = array.splice(2, undefined, 'test', 'value');
            expect(deleted).toEqual([]);
            expect(array.toArray()).toEqual([
                'hello',
                'world',
                'test',
                'value',
                '123',
                '456',
            ]);
        });

        it('should be able to use splice with negative start to insert items counted from the end of the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');
            array.push('123');
            array.push('456');

            const deleted = array.splice(-2, undefined, 'test', 'value');
            expect(deleted).toEqual([]);
            expect(array.toArray()).toEqual([
                'hello',
                'world',
                'test',
                'value',
                '123',
                '456',
            ]);
        });

        it('should be able to use splice to replace items in the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');
            array.push('123');
            array.push('456');

            const deleted = array.splice(2, 2, 'test', 'value');
            expect(deleted).toEqual(['123', '456']);
            expect(array.toArray()).toEqual([
                'hello',
                'world',
                'test',
                'value',
            ]);
        });

        it('should be able to map over the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');

            const mapped = array.map((v) => v.toUpperCase());
            expect(mapped).toEqual(['HELLO', 'WORLD']);
        });

        it('should be able to filter the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');

            const filtered = array.filter((v) => v === 'hello');
            expect(filtered).toEqual(['hello']);
        });

        it('should be able to iterate over the array', () => {
            const array = document.getArray('abc');
            array.push('hello');
            array.push('world');

            const values: string[] = [];
            array.forEach((v) => values.push(v));
            expect(values).toEqual(['hello', 'world']);
        });

        it('should be able to get the document from an array', () => {
            const array = document.getArray('abc');
            array.push('hello');

            expect(array.doc === document).toBe(true);
        });

        it('should return undefined if the array doesnt have a parent', () => {
            const array = document.getArray('abc');
            expect(array.parent).toBeUndefined();
        });

        it('should be able to set an array in an array', () => {
            const array1 = document.getArray('abc');
            const array2 = document.createArray();

            array2.push('hello');

            array1.push(array2);

            expect(array1.get(0) === array2).toBe(true);
            expect(array2.parent === array1).toBe(true);
            expect(array2.doc === document).toBe(true);

            expect(array1.toJSON()).toEqual([['hello']]);
        });

        it('should be able to set a map in an array', () => {
            const array1 = document.getArray('abc');
            const map1 = document.createMap();

            map1.set('hello', 'world');

            array1.push(map1);

            expect(array1.get(0) === map1).toBe(true);
            expect(map1.parent === array1).toBe(true);
            expect(map1.doc === document).toBe(true);

            expect(array1.toJSON()).toEqual([
                {
                    hello: 'world',
                },
            ]);
        });

        it('should be able to set text in an array', () => {
            const array1 = document.getArray('abc');
            const text1 = document.createText();

            text1.insert(0, 'hello');

            array1.push(text1);

            expect(array1.get(0) === text1).toBe(true);
            expect(text1.parent === array1).toBe(true);
            expect(text1.doc === document).toBe(true);

            expect(array1.toJSON()).toEqual(['hello']);
        });

        it('should be able to emit changes', async () => {
            const array = document.getArray('abc');
            let changes: SharedArrayChanges<any>[] = [];

            sub.add(array.changes.subscribe((c) => changes.push(c)));

            array.push('hello');
            array.push('world');
            array.delete(1, 1);

            await waitAsync();

            expect(changes.length).toBe(3);
            expect(changes[0].type).toBe('array');
            expect(changes[0].target === array).toBe(true);
            expect(changes[0].delta).toEqual([
                {
                    type: 'insert',
                    values: ['hello'],
                },
            ]);
            expect(changes[1].type).toBe('array');
            expect(changes[1].target === array).toBe(true);
            expect(changes[1].delta).toEqual([
                {
                    type: 'preserve',
                    count: 1,
                },
                {
                    type: 'insert',
                    values: ['world'],
                },
            ]);
            expect(changes[2].type).toBe('array');
            expect(changes[2].target === array).toBe(true);
            expect(changes[2].delta).toEqual([
                {
                    type: 'preserve',
                    count: 1,
                },
                {
                    type: 'delete',
                    count: 1,
                },
            ]);
        });
    });

    describe('getText()', () => {
        it('should return an array', () => {
            expect(document.getText('abc')).toBeTruthy();
        });

        it('should be able to get the same text multiple times', () => {
            const array1 = document.getText('abc');
            const array2 = document.getText('abc');

            expect(array1).toBe(array2);
        });

        it('should return different text for different keys', () => {
            const map1 = document.getText('abc');
            const map2 = document.getText('def');

            expect(map1).not.toBe(map2);
        });

        it('should be able to store strings in a text', () => {
            const array = document.getText('abc');
            array.insert(0, 'hello');

            expect(array.toString()).toEqual('hello');
        });

        it('should be able to insert text at the end', () => {
            const array = document.getText('abc');
            array.insert(0, 'hello');
            array.insert(5, ' world');

            expect(array.toString()).toEqual('hello world');
        });

        it('should be able to insert text at the beginning', () => {
            const array = document.getText('abc');
            array.insert(0, 'hello');
            array.insert(0, 'world');

            expect(array.toString()).toEqual('worldhello');
        });

        it('should be able to delete chars from the text', () => {
            const array = document.getText('abc');
            array.insert(0, 'hello');
            array.delete(0, 1);

            expect(array.toString()).toEqual('ello');
        });

        it('should be able to get a slice of text', () => {
            const array = document.getText('abc');
            array.insert(0, 'hello');

            expect(array.slice(0, 2)).toEqual('he');
        });
    });

    describe('transact()', () => {
        it('should batch changes', async () => {
            const map = document.getMap('abc');
            const array = document.getArray('def');
            let mapChanges: SharedMapChanges<any>[] = [];
            let arrayChanges: SharedArrayChanges<any>[] = [];

            sub.add(map.changes.subscribe((c) => mapChanges.push(c)));
            sub.add(array.changes.subscribe((c) => arrayChanges.push(c)));

            document.transact(() => {
                map.set('hello', 'world');
                map.set('hello', 'different');
                array.push('test');
            });

            await waitAsync();

            expect(mapChanges.length).toBe(1);
            expect(arrayChanges.length).toBe(1);
            expect(mapChanges[0].type).toBe('map');
            expect(mapChanges[0].target === map).toBe(true);
            expect(mapChanges[0].changes).toEqual(
                new Map([
                    [
                        'hello',
                        {
                            action: 'add',
                            oldValue: undefined,
                        },
                    ],
                ])
            );

            expect(arrayChanges[0].type).toBe('array');
            expect(arrayChanges[0].target === array).toBe(true);
            expect(arrayChanges[0].delta).toEqual([
                {
                    type: 'insert',
                    values: ['test'],
                },
            ]);
        });
    });

    describe('getStateUpdate()', () => {
        it('should be able to apply the update to another document', async () => {
            const map = document.getMap('abc');
            map.set('hello', 'world');

            const state = document.getStateUpdate();

            const document2 = await createDocument();
            document2.applyStateUpdates([state]);

            const map2 = document2.getMap('abc');
            expect(map2.toJSON()).toEqual(map.toJSON());
        });
    });
}
