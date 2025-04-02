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
import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import type { InstUpdate } from '../bots';
import {
    ORIGINAL_OBJECT,
    action,
    botAdded,
    botUpdated,
    createBot,
    createInitializationUpdate,
    getInstStateFromUpdates,
} from '../bots';
import {
    constructInitializationUpdate,
    convertErrorToCopiableValue,
    convertToCopiableValue,
    ensureBotIsSerializable,
    ensureTagIsSerializable,
    getStateFromUpdates,
    mergeInstUpdates,
    supportsRemoteEvent,
} from './PartitionUtils';
import { YjsPartitionImpl } from './YjsPartition';
import { customDataTypeCases, waitAsync } from '../test/TestHelpers';
import { createDummyRuntimeBot } from '../../aux-runtime/runtime/test/TestScriptBotFactory';
import { DateTime } from 'luxon';
import { Rotation, Vector2, Vector3 } from '../math';
import type { PartitionRemoteEvents } from '.';
import { remote, remoteResult } from '../common';

describe('constructInitializationUpdate()', () => {
    it('should return an update that represents the bots', async () => {
        const action = createInitializationUpdate([
            createBot('test1', {
                abc: 'def',
            }),
            createBot('test2', {
                num: 123,
            }),
        ]);

        const update = constructInitializationUpdate(action);

        expect(update).toEqual({
            id: 0,
            timestamp: expect.any(Number),
            update: expect.any(String),
        });

        const validationPartition = new YjsPartitionImpl({
            type: 'yjs',
        });
        applyUpdate(validationPartition.doc, toByteArray(update.update));

        expect(validationPartition.state).toEqual({
            test1: createBot('test1', {
                abc: 'def',
            }),
            test2: createBot('test2', {
                num: 123,
            }),
        });
    });

    it('should support two different initialization updates', async () => {
        const action1 = createInitializationUpdate([
            createBot('test1', {
                abc: 'def',
            }),
            createBot('test2', {
                num: 123,
            }),
        ]);

        const update1 = constructInitializationUpdate(action1);

        const action2 = createInitializationUpdate([
            createBot('test3', {
                val: true,
            }),
            createBot('test4', {
                str: 'hello',
            }),
        ]);

        const update2 = constructInitializationUpdate(action2);

        const validationPartition = new YjsPartitionImpl({
            type: 'yjs',
        });
        applyUpdate(validationPartition.doc, toByteArray(update1.update));
        applyUpdate(validationPartition.doc, toByteArray(update2.update));

        expect(validationPartition.state).toEqual({
            test1: createBot('test1', {
                abc: 'def',
            }),
            test2: createBot('test2', {
                num: 123,
            }),
            test3: createBot('test3', {
                val: true,
            }),
            test4: createBot('test4', {
                str: 'hello',
            }),
        });
    });
});

describe('getStateFromUpdates()', () => {
    it('should return the state matching the given updates', async () => {
        const state = getStateFromUpdates(
            getInstStateFromUpdates([
                {
                    id: 0,
                    timestamp: 0,
                    update: 'AQLNrtWDBQAnAQRib3RzBGJvdDEBKADNrtWDBQAEdGFnMQF3A2FiYwA=',
                },
            ])
        );

        expect(state).toEqual({
            bot1: createBot('bot1', {
                tag1: 'abc',
            }),
        });
    });
});

describe('mergeInstUpdates()', () => {
    it('should merge the updates into a single update', async () => {
        const partition = new YjsPartitionImpl({
            type: 'yjs',
        });

        let updates: InstUpdate[] = [];
        partition.doc.on('update', (update: Uint8Array) => {
            updates.push({
                id: updates.length,
                timestamp: updates.length * 10,
                update: fromByteArray(update),
            });
        });

        await partition.applyEvents([
            botAdded(createBot('test1', { abc: 'def' })),
        ]);

        await waitAsync();

        await partition.applyEvents([
            botAdded(createBot('test2', { num: 999 })),
        ]);

        await waitAsync();

        await partition.applyEvents([
            botUpdated('test1', { tags: { abc: 'xyz' } }),
        ]);

        await waitAsync();

        const mergedUpdate: InstUpdate = mergeInstUpdates(updates, 123, 987);

        expect(mergedUpdate).toEqual({
            id: 123,
            timestamp: 987,
            update: expect.any(String),
        });

        const validationPartition = new YjsPartitionImpl({
            type: 'yjs',
        });
        applyUpdate(validationPartition.doc, toByteArray(mergedUpdate.update));

        expect(validationPartition.state).toEqual({
            test1: createBot('test1', {
                abc: 'xyz',
            }),
            test2: createBot('test2', {
                num: 999,
            }),
        });
    });
});

describe('convertErrorToCopiableValue()', () => {
    it('should convert error objects into an object with message and name', () => {
        const err1 = new Error('abc');
        const err2 = new SyntaxError('def');

        expect(convertErrorToCopiableValue(err1)).toEqual({
            name: 'Error',
            message: 'abc',
            stack: expect.any(String),
        });
        expect(convertErrorToCopiableValue(err2)).toEqual({
            name: 'SyntaxError',
            message: 'def',
            stack: expect.any(String),
        });
    });

    it('should include a cut-down version of the response object stored in the error', () => {
        const err1 = new Error('abc') as any;
        err1.response = {
            extra: 'wrong',
            data: { abc: 'def' },
            headers: { header1: true },
            status: 500,
            statusText: '',
        };

        expect(convertErrorToCopiableValue(err1)).toEqual({
            name: 'Error',
            message: 'abc',
            stack: expect.any(String),
            response: {
                data: { abc: 'def' },
                headers: { header1: true },
                status: 500,
                statusText: '',
            },
        });
    });
});

describe('convertToCopiableValue()', () => {
    it('should leave strings alone', () => {
        const result = convertToCopiableValue('test');
        expect(result).toBe('test');
    });

    it('should leave numbers alone', () => {
        const result = convertToCopiableValue(0.23);
        expect(result).toBe(0.23);
    });

    it('should leave booleans alone', () => {
        const result = convertToCopiableValue(true);
        expect(result).toBe(true);
    });

    it('should leave simple objects alone', () => {
        const obj = {
            test: 'abc',
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual(obj);
    });

    it('should leave arrays alone', () => {
        const arr = ['abc'];
        const result = convertToCopiableValue(arr);
        expect(result).toEqual(arr);
    });

    it('should leave nulls alone', () => {
        const result = convertToCopiableValue(null);
        expect(result).toBe(null);
    });

    it('should leave dates alone', () => {
        const result = convertToCopiableValue(new Date(2021, 10, 14));
        expect(result).toEqual(new Date(2021, 10, 14));
    });

    it('should leave undefined alone', () => {
        const result = convertToCopiableValue(undefined);
        expect(result).toBeUndefined();
    });

    it('should leave Blobs alone', () => {
        const value = new Blob(['abc']);
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    it('should leave ArrayBuffer objects alone', () => {
        const value = new ArrayBuffer(10);
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    const viewCases = [
        ['Uint8Array', new Uint8Array(20)] as const,
        ['Uint16Array', new Uint16Array(20)] as const,
        ['Uint32Array', new Uint32Array(20)] as const,
        ['Int8Array', new Int8Array(20)] as const,
        ['Int16Array', new Int16Array(20)] as const,
        ['Int32Array', new Int32Array(20)] as const,
        ['Float32Array', new Float32Array(20)] as const,
        ['Float64Array', new Float64Array(20)] as const,
    ];

    it.each(viewCases)('should leave %s views alone', (desc, value) => {
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    it('should convert invalid properties in objects recursively', () => {
        const obj = {
            test: 'abc',
            func: function abc() {},
            err: new Error('qwerty'),
            nested: {
                func: function def() {},
                err: new SyntaxError('syntax'),
            },
            arr: [function ghi() {}, new Error('other')],
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual({
            test: 'abc',
            func: '[Function abc]',
            err: 'Error: qwerty',
            nested: {
                func: '[Function def]',
                err: 'SyntaxError: syntax',
            },
            arr: ['[Function ghi]', 'Error: other'],
        });
    });

    it('should convert invalid properties in arrays recursively', () => {
        const arr = [
            'abc',
            function abc() {},
            new Error('qwerty'),
            {
                func: function def() {},
                err: new SyntaxError('syntax'),
            },
            [function ghi() {}, new Error('other')],
        ];
        const result = convertToCopiableValue(arr);
        expect(result).toEqual([
            'abc',
            '[Function abc]',
            'Error: qwerty',
            {
                func: '[Function def]',
                err: 'SyntaxError: syntax',
            },
            ['[Function ghi]', 'Error: other'],
        ]);
    });

    it('should remove the metadata property from bots', () => {
        const obj: any = {
            id: 'test',
            metadata: {
                ref: null,
                tags: null,
            },
            tags: {},
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual({
            id: 'test',
            tags: {},
        });
    });

    it('should convert functions to a string', () => {
        function test() {}
        const result = convertToCopiableValue(test);

        expect(result).toBe('[Function test]');
    });

    it('should format DateTime objects', () => {
        const value = DateTime.utc(2012, 11, 13, 14, 15, 16);
        const result = convertToCopiableValue(value);
        expect(result).toBe('📅2012-11-13T14:15:16Z');
    });

    it('should format Vector2 objects', () => {
        const value = new Vector2(1, 2);
        const result = convertToCopiableValue(value);
        expect(result).toBe('➡️1,2');
    });

    it('should format Vector3 objects', () => {
        const value = new Vector3(1, 2, 3);
        const result = convertToCopiableValue(value);
        expect(result).toBe('➡️1,2,3');
    });

    it('should format Rotation objects', () => {
        const value = new Rotation();
        const result = convertToCopiableValue(value);
        expect(result).toBe('🔁0,0,0,1');
    });

    const errorCases = [
        ['Error', new Error('abcdef'), 'Error: abcdef'],
        ['SyntaxError', new SyntaxError('xyz'), 'SyntaxError: xyz'],
    ];

    it.each(errorCases)(
        'should convert %s to a string',
        (desc, err, expected) => {
            const result = convertToCopiableValue(err);
            expect(result).toBe(expected);
        }
    );

    it('should convert simple recursive objects', () => {
        let test1 = {
            test2: null as any,
        };
        let test3 = {
            test1: test1,
        };
        let test2 = {
            test3: test3,
        };

        test1.test2 = test2;
        const result = convertToCopiableValue(test1);

        expect(result).toEqual(test1);
    });

    it('should convert deep objects to a string', () => {
        let obj = {} as any;
        let current = obj;
        for (let i = 0; i < 10000; i++) {
            current = current['deep'] = {};
        }

        const result = convertToCopiableValue(obj);

        expect(result).toBe('[Nested object]');
    });

    it('should convert simple bots', () => {
        let bot1 = createDummyRuntimeBot('test1');
        bot1.tags.abc = '123';

        expect(convertToCopiableValue(bot1)).toEqual({
            id: 'test1',
            tags: {
                abc: '123',
            },
        });
    });

    it('should include the space in converted bots', () => {
        let bot1 = createDummyRuntimeBot(
            'test1',
            {
                abc: '123',
            },
            'mySpace' as any
        );

        expect(convertToCopiableValue(bot1)).toEqual({
            id: 'test1',
            space: 'mySpace' as any,
            tags: {
                abc: '123',
            },
        });
    });

    it('should grab the original object', () => {
        const value = {
            abc: 'def',
            [ORIGINAL_OBJECT]: {
                abc: 'abc',
            },
        };
        let result = convertToCopiableValue(value);
        expect(result).toEqual({
            abc: 'abc',
        });
        expect(result !== value);
    });
});

describe('ensureBotIsSerializable()', () => {
    it.each(customDataTypeCases)(
        'should return a new bot with the copiable version for %s values',
        (desc, given, expected) => {
            const inputBot = createBot('test', {
                value: given,
            });
            let result = ensureBotIsSerializable(inputBot);

            expect(result).toEqual(
                createBot('test', {
                    value: expected,
                })
            );
            expect(result !== inputBot).toBe(true);
        }
    );

    it('should use the original object for tag values', () => {
        const inputBot = createBot('test', {
            value: {
                abc: 'def',
                [ORIGINAL_OBJECT]: {
                    abc: 'abc',
                },
            },
        });
        let result = ensureBotIsSerializable(inputBot);

        expect(result).toEqual(
            createBot('test', {
                value: {
                    abc: 'abc',
                },
            })
        );
        expect(result !== inputBot).toBe(true);
    });

    it('should use the original object for values inside objects', () => {
        const inputBot = createBot('test', {
            value: {
                abc: 'def',
                other: {
                    val: 123,
                    [ORIGINAL_OBJECT]: {
                        val: 456,
                    },
                },
            },
        });
        let result = ensureBotIsSerializable(inputBot);

        expect(result).toEqual(
            createBot('test', {
                value: {
                    abc: 'def',
                    other: {
                        val: 456,
                    },
                },
            })
        );
        expect(result !== inputBot).toBe(true);
    });

    it('should use the original object for deeply nested values inside objects', () => {
        const inputBot = createBot('test', {
            value: {
                abc: 'def',
                deep: {
                    level: {
                        other: {
                            val: 123,
                            [ORIGINAL_OBJECT]: {
                                val: 456,
                            },
                        },
                    },
                },
            },
        });
        let result = ensureBotIsSerializable(inputBot);

        expect(result).toEqual(
            createBot('test', {
                value: {
                    abc: 'def',
                    deep: {
                        level: {
                            other: {
                                val: 456,
                            },
                        },
                    },
                },
            })
        );
        expect(result !== inputBot).toBe(true);
    });

    it('should use the original object for values inside arrays', () => {
        const inputBot = createBot('test', {
            value: [
                'def',
                {
                    val: 123,
                    [ORIGINAL_OBJECT]: {
                        val: 456,
                    },
                },
            ],
        });
        let result = ensureBotIsSerializable(inputBot);

        expect(result).toEqual(
            createBot('test', {
                value: [
                    'def',
                    {
                        val: 456,
                    },
                ],
            })
        );
        expect(result !== inputBot).toBe(true);
    });

    it('should preserve null tags', () => {
        const inputBot = createBot('test', {
            value: null,
        });
        let result = ensureBotIsSerializable(inputBot);

        expect(result).toEqual(
            createBot('test', {
                value: null,
            })
        );
    });

    it('should return the given bot if everything is normal', () => {
        let b = createBot('test', {
            abc: 123,
            def: 'ghi',
        });
        let result = ensureBotIsSerializable(b);

        expect(result).toBe(b);
    });
});

describe('ensureTagIsSerializable()', () => {
    it.each(customDataTypeCases)(
        'should return a new bot with the copiable version for %s values',
        (desc, given, expected) => {
            let result = ensureTagIsSerializable(given);

            expect(result).toEqual(expected);
        }
    );

    it('should use the original object for tag values', () => {
        const inputValue = {
            abc: 'def',
            [ORIGINAL_OBJECT]: {
                abc: 'abc',
            },
        };
        let result = ensureTagIsSerializable(inputValue);

        expect(result).toEqual({
            abc: 'abc',
        });
        expect(result !== inputValue).toBe(true);
        expect(result === inputValue[ORIGINAL_OBJECT]).toBe(true);
    });

    it('should preserve null tags', () => {
        const inputBot: any = null;
        let result = ensureTagIsSerializable(inputBot);

        expect(result).toEqual(null);
    });

    it('should return the given value if everything is normal', () => {
        let b = {
            abc: 123,
            def: 'ghi',
        };
        let result = ensureTagIsSerializable(b);

        expect(result).toBe(b);
    });
});

describe('supportsRemoteEvent()', () => {
    it('should return true if the remote event is supported', () => {
        const config: PartitionRemoteEvents | boolean = {
            create_initialization_update: true,
        };
        const result = supportsRemoteEvent(
            config,
            remote(createInitializationUpdate([]))
        );

        expect(result).toBe(true);
    });

    it('should return true if the remote actions are supported but the type is not in the config', () => {
        const config: PartitionRemoteEvents | boolean = {
            remoteActions: true,
        };
        const result = supportsRemoteEvent(config, remote(action('event')));

        expect(result).toBe(true);
    });

    it('should return true if the remote actions are supported and the action is a remote result action', () => {
        const config: PartitionRemoteEvents | boolean = {
            remoteActions: true,
        };
        const result = supportsRemoteEvent(config, remoteResult(123));

        expect(result).toBe(true);
    });

    it('should return false if the type is not in the config', () => {
        const config: PartitionRemoteEvents | boolean = {};
        const result = supportsRemoteEvent(
            config,
            remote(createInitializationUpdate([]))
        );

        expect(result).toBe(false);
    });

    it('should return true if the config is true', () => {
        const config: PartitionRemoteEvents | boolean = true;
        const result = supportsRemoteEvent(
            config,
            remote(createInitializationUpdate([]))
        );

        expect(result).toBe(true);
    });
});
