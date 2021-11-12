import {
    BOT_SPACE_TAG,
    PrecalculatedBot,
    BotTagMasks,
    TEMPORARY_BOT_PARTITION_ID,
    COOKIE_BOT_PARTITION_ID,
    TEMPORARY_SHARED_PARTITION_ID,
    REMOTE_TEMPORARY_SHARED_PARTITION_ID,
    DEFAULT_TAG_MASK_SPACE,
    RuntimeBot,
    CLEAR_CHANGES_SYMBOL,
    SET_TAG_MASK_SYMBOL,
    CLEAR_TAG_MASKS_SYMBOL,
    isRuntimeBot,
    EDIT_TAG_SYMBOL,
    EDIT_TAG_MASK_SYMBOL,
    hasValue,
} from '../bots';
import { AuxGlobalContext, MemoryGlobalContext } from './AuxGlobalContext';
import {
    createRuntimeBot,
    RuntimeBotInterface,
    RealtimeEditMode,
    flattenTagMasks,
} from './RuntimeBot';
import { TestScriptBotFactory } from './test/TestScriptBotFactory';
import { createCompiledBot, CompiledBot } from './CompiledBot';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import {
    applyTagEdit,
    del,
    edit,
    edits,
    insert,
    isTagEdit,
    preserve,
    remoteEdit,
    remoteEdits,
} from '../aux-format-2';
import { types } from 'util';

describe('RuntimeBot', () => {
    let precalc: CompiledBot;
    let script: RuntimeBot;
    let context: AuxGlobalContext;
    let version: AuxVersion;
    let device: AuxDevice;
    let manager: RuntimeBotInterface;
    let updateTagMock: jest.Mock;
    let getListenerMock: jest.Mock;
    let getRawValueMock: jest.Mock;
    let getSignatureMock: jest.Mock;
    let notifyChangeMock: jest.Mock;
    let updateTagMaskMock: jest.Mock;
    let getTagMaskMock: jest.Mock;

    beforeEach(() => {
        version = {
            hash: 'hash',
            version: 'v1.2.3',
            major: 1,
            minor: 2,
            patch: 3,
        };
        device = {
            supportsAR: true,
            supportsVR: false,
            isCollaborative: true,
            ab1BootstrapUrl: 'ab1Bootstrap',
        };
        updateTagMock = jest.fn();
        updateTagMock.mockImplementation((bot, tag, value) => {
            if (isTagEdit(value)) {
                bot.values[tag] = bot.tags[tag] = applyTagEdit(
                    bot.tags[tag],
                    value
                );
            } else {
                if (hasValue(value)) {
                    bot.values[tag] = value;
                    bot.tags[tag] = value;
                } else {
                    delete bot.values[tag];
                    delete bot.tags[tag];
                }
            }
            return RealtimeEditMode.Immediate;
        });

        updateTagMaskMock = jest.fn();
        updateTagMaskMock.mockImplementation((bot, tag, spaces, value) => {
            if (!bot.masks) {
                bot.masks = {};
            }
            for (let space of spaces) {
                if (!bot.masks[space]) {
                    bot.masks[space] = {};
                }
                if (isTagEdit(value)) {
                    bot.masks[space][tag] = applyTagEdit(
                        bot.masks[space][tag],
                        value
                    );
                } else {
                    if (hasValue(value)) {
                        bot.masks[space][tag] = value;
                    } else {
                        delete bot.masks[space][tag];
                    }
                }
            }
            return RealtimeEditMode.Immediate;
        });

        getTagMaskMock = jest.fn();
        getTagMaskMock.mockImplementation((bot, tag) => {
            if (!bot.masks) {
                return undefined;
            }
            for (let space in bot.masks) {
                if (tag in bot.masks[space]) {
                    return bot.masks[space][tag];
                }
            }
            return undefined;
        });

        getListenerMock = jest.fn(
            (bot: CompiledBot, tag: string) => bot.listeners[tag]
        );

        getRawValueMock = jest.fn((bot: PrecalculatedBot, tag: string) => {
            return bot.tags[tag];
        });

        getSignatureMock = jest.fn((bot: PrecalculatedBot, tag: string) => {
            return bot.signatures[tag];
        });
        notifyChangeMock = jest.fn();
        manager = {
            updateTag: updateTagMock,
            getValue(bot: PrecalculatedBot, tag: string) {
                return bot.values[tag];
            },
            getRawValue: getRawValueMock,
            getListener: getListenerMock,
            getSignature: getSignatureMock,
            notifyChange: notifyChangeMock,
            updateTagMask: updateTagMaskMock,
            getTagMask: getTagMaskMock,
            currentVersion: {
                localSites: {},
                vector: {
                    a: 1,
                    b: 2,
                    c: 3,
                },
            },
        };
        context = new MemoryGlobalContext(
            version,
            device,
            new TestScriptBotFactory(),
            manager
        );

        precalc = createCompiledBot(
            'test',
            {
                abc: 'def',
                ghi: 123,
                bool: true,
                different: 'string',
            },
            {
                abc: 'def',
                ghi: 123,
                bool: true,
                different: 987,
            },
            'shared'
        );
        precalc.signatures = {
            sig1: 'abc',
            sig2: 'def',
            sig3: 'ghi',
        };

        script = createRuntimeBot(precalc, manager);
    });

    describe('tags', () => {
        it('should contain the values from the precalculated bot', () => {
            expect(script.tags).toEqual({
                ...precalc.values,
            });
        });

        it('should be able to enumerate the tags on the bot', () => {
            let objectTags = Object.keys(script.tags);
            let forTags = [] as string[];
            for (let tag in script.tags) {
                forTags.push(tag);
            }

            expect(objectTags).toEqual(forTags);
            expect(forTags).toEqual(['abc', 'ghi', 'bool', 'different']);
        });

        it('should return the bot ID when getting the ID tag', () => {
            expect(script.tags.id).toEqual(script.id);
        });

        it('should return the bot space when getting the space tag', () => {
            expect(script.tags[BOT_SPACE_TAG]).toEqual(script.space);
        });

        it('should return the default space when the bot has no specified space', () => {
            precalc = createCompiledBot('test', {}, undefined);
            script = createRuntimeBot(precalc, manager);
            expect(script.tags[BOT_SPACE_TAG]).toEqual('shared');
        });

        it('should return the toJSON() function', () => {
            expect(typeof script.tags.toJSON).toEqual('function');
        });

        it('should call updateTag() on the manager when a tag is set', () => {
            script.tags.fun = 'hello';
            expect(manager.updateTag).toHaveBeenCalledWith(
                precalc,
                'fun',
                'hello'
            );
        });

        it('should update the raw tags with the new value', () => {
            script.tags.fun = 'hello';
            expect(script.raw.fun).toEqual('hello');
        });

        it('should prevent setting the tag when updateTag() returns RealtimeEditMode.None', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.None);
            script.tags.fun = 'hello';
            expect(script.tags.fun).not.toEqual('hello');
            expect(script.raw.fun).not.toEqual('hello');
        });

        it('should inherit value changes made to the original bot', () => {
            precalc.values.fun = 'hello';
            expect(script.tags.fun).toEqual('hello');
        });

        it('should support the delete keyword', () => {
            delete script.tags.abc;
            expect(script.raw.abc).toBeUndefined();
            expect(manager.updateTag).toHaveBeenCalledWith(
                precalc,
                'abc',
                null
            );
        });

        it('should prevent deleting the tag when updateTag() returns RealtimeEditMode.None', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.None);
            delete script.tags.abc;
            expect(script.tags.abc).not.toEqual(null);
            expect(script.raw.abc).not.toEqual(null);
        });

        it('should delay setting the tag when updateTag() returns RealtimeEditMode.Delayed', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.Delayed);
            script.tags.abc = 'fun';
            expect(script.tags.abc).not.toEqual('fun');
            expect(script.raw.abc).not.toEqual('fun');
            expect(script.changes.abc).toEqual('fun');
        });

        it('should delay deleting the tag when updateTag() returns RealtimeEditMode.Delayed', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.Delayed);
            delete script.tags.abc;
            expect(script.tags.abc).not.toEqual(null);
            expect(script.raw.abc).not.toEqual(null);
            expect(script.changes.abc).toEqual(null);
        });

        it('should support Object.keys() for tags that were added after the bot was created', () => {
            const keys1 = Object.keys(script.tags);
            keys1.sort();

            expect(keys1).toEqual(['abc', 'bool', 'different', 'ghi']);

            script.tags.newTag = true;

            const keys2 = Object.keys(script.tags);
            keys2.sort();

            expect(keys2).toEqual([
                'abc',
                'bool',
                'different',
                'ghi',
                'newTag',
            ]);

            precalc.values.otherNewTag = false;

            const keys3 = Object.keys(script.tags);
            keys3.sort();

            expect(keys3).toEqual([
                'abc',
                'bool',
                'different',
                'ghi',
                'newTag',
                'otherNewTag',
            ]);
        });

        it('should support Object.keys() for tags that were deleted from the bot', () => {
            const keys1 = Object.keys(script.tags);
            keys1.sort();

            expect(keys1).toEqual(['abc', 'bool', 'different', 'ghi']);

            script.tags.abc = null;

            const keys2 = Object.keys(script.tags);
            keys2.sort();

            expect(keys2).toEqual(['bool', 'different', 'ghi']);

            delete precalc.values.bool;

            const keys3 = Object.keys(script.tags);
            keys3.sort();

            expect(keys3).toEqual(['different', 'ghi']);
        });

        describe('toJSON()', () => {
            it('should return the raw tags that are on the bot', () => {
                const { toJSON, ...first } = script.tags.toJSON();

                expect(first).toEqual({
                    abc: 'def',
                    ghi: 123,
                    bool: true,
                    different: 987,
                });
            });

            it('should return raw tags that have been added to the compiled bot', () => {
                precalc.tags.newTag = '987';

                const { toJSON, ...first } = script.tags.toJSON();

                expect(first).toEqual({
                    abc: 'def',
                    ghi: 123,
                    bool: true,
                    different: 987,
                    newTag: '987',
                });
            });

            it('should return raw tags that have been added to the runtime bot', () => {
                script.tags.newTag = '987';

                const { toJSON, ...first } = script.tags.toJSON();

                expect(first).toEqual({
                    abc: 'def',
                    ghi: 123,
                    bool: true,
                    different: 987,
                    newTag: '987',
                });
            });

            it('should not be circular', () => {
                const result = script.tags.toJSON();

                expect(result).toEqual({
                    abc: 'def',
                    ghi: 123,
                    bool: true,
                    different: 987,
                });
            });
        });

        describe('array', () => {
            beforeEach(() => {
                precalc.tags.arr = precalc.values.arr = ['hello'];
            });

            it('should return an array-like object', () => {
                expect(script.tags.arr).toEqual(['hello']);
                expect(script.raw.arr).toEqual(['hello']);
                expect(Array.isArray(script.tags.arr)).toBe(true);
                expect(Array.isArray(script.raw.arr)).toBe(true);
            });

            it('should support setting an item in an array', () => {
                const ret = (script.tags.arr[0] = 'test');

                const expected = ['test'];
                expect(ret).toEqual('test');
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support pushing an item to an array', () => {
                const ret = script.tags.arr.push('test');

                const expected = ['hello', 'test'];
                expect(ret).toBe(2);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support popping an item from an array', () => {
                const ret = script.tags.arr.pop();

                const expected = [] as any[];
                expect(ret).toEqual('hello');
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support unshifting an item to an array', () => {
                const ret = script.tags.arr.unshift('test1', 'test2');

                const expected = ['test1', 'test2', 'hello'] as any[];
                expect(ret).toBe(3);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support shifting an item from an array', () => {
                const ret = script.tags.arr.shift();

                const expected = [] as any[];
                expect(ret).toEqual('hello');
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support filling an array', () => {
                precalc.tags.arr = precalc.values.arr = [
                    'hello',
                    'test1',
                    'test2',
                ];
                const ret = script.tags.arr.fill(10);

                const expected = [10, 10, 10] as any[];
                expect(ret).toEqual(expected);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support sorting the array', () => {
                precalc.tags.arr = precalc.values.arr = ['zyx', 'lhm', 'abc'];
                const ret = script.tags.arr.sort();

                const expected = ['abc', 'lhm', 'zyx'] as any[];
                expect(ret).toEqual(expected);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support splicing the array', () => {
                precalc.tags.arr = precalc.values.arr = ['zyx', 'lhm', 'abc'];
                const ret = script.tags.arr.splice(1, 1, 'def');

                const expected = ['zyx', 'def', 'abc'] as any[];
                expect(ret).toEqual(['lhm']);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should support expanding an array by setting the length', () => {
                const ret = (script.tags.arr.length = 5);

                const expected = [
                    'hello',
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                ] as any[];
                expect(ret).toBe(5);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should unwrap the array proxy when saving to another tag', () => {
                const abc = [123];
                script.tags.arr = abc;
                script.tags.other = script.tags.arr;

                const expected = [123];
                expect(script.tags.other).toEqual(expected);
                expect(script.raw.other).toEqual(expected);

                expect(script.changes.other).toBe(abc);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });
        });
    });

    describe('raw', () => {
        it('should contain the tags from the precalculated bot', () => {
            expect(script.raw).toEqual({
                ...precalc.tags,
            });
        });

        it('should be able to enumerate the tags on the bot', () => {
            let objectTags = Object.keys(script.raw);
            let forTags = [] as string[];
            for (let tag in script.raw) {
                forTags.push(tag);
            }

            expect(objectTags).toEqual(forTags);
            expect(forTags).toEqual(['abc', 'ghi', 'bool', 'different']);
        });

        it('should return the bot ID when getting the ID tag', () => {
            expect(script.raw.id).toEqual(script.id);
        });

        it('should return the bot space when getting the space tag', () => {
            expect(script.raw[BOT_SPACE_TAG]).toEqual(script.space);
        });

        it('should return the default space when the bot has no specified space', () => {
            precalc = createCompiledBot('test', {}, undefined);
            script = createRuntimeBot(precalc, manager);
            expect(script.raw[BOT_SPACE_TAG]).toEqual('shared');
        });

        it('should call updateTag() on the manager when a tag is set', () => {
            script.raw.fun = 'hello';
            expect(manager.updateTag).toHaveBeenCalledWith(
                precalc,
                'fun',
                'hello'
            );
        });

        it('should prevent setting the tag when updateTag() returns RealtimeEditMode.None', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.None);
            script.raw.fun = 'hello';
            expect(script.tags.fun).not.toEqual('hello');
            expect(script.raw.fun).not.toEqual('hello');
        });

        it('should support the delete keyword', () => {
            delete script.raw.abc;
            expect(script.raw.abc).toBeUndefined();
            expect(manager.updateTag).toHaveBeenCalledWith(
                precalc,
                'abc',
                null
            );
        });

        it('should prevent deleting the tag when updateTag() returns RealtimeEditMode.None', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.None);
            delete script.raw.abc;
            expect(script.tags.abc).not.toEqual(null);
            expect(script.raw.abc).not.toEqual(null);
        });

        it('should delay setting the tag when updateTag() returns RealtimeEditMode.Delayed', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.Delayed);
            script.raw.abc = 'fun';
            expect(script.tags.abc).not.toEqual('fun');
            expect(script.raw.abc).not.toEqual('fun');
            expect(script.changes.abc).toEqual('fun');
        });

        it('should delay deleting the tag when updateTag() returns RealtimeEditMode.Delayed', () => {
            updateTagMock.mockReturnValueOnce(RealtimeEditMode.Delayed);
            delete script.raw.abc;
            expect(script.tags.abc).not.toEqual(null);
            expect(script.raw.abc).not.toEqual(null);
            expect(script.changes.abc).toEqual(null);
        });

        it('should Object.keys() for tags that were added after the bot was created', () => {
            const keys1 = Object.keys(script.raw);
            keys1.sort();

            expect(keys1).toEqual(['abc', 'bool', 'different', 'ghi']);

            script.raw.newTag = true;

            const keys2 = Object.keys(script.raw);
            keys2.sort();

            expect(keys2).toEqual([
                'abc',
                'bool',
                'different',
                'ghi',
                'newTag',
            ]);

            precalc.tags.otherNewTag = false;

            const keys3 = Object.keys(script.raw);
            keys3.sort();

            expect(keys3).toEqual([
                'abc',
                'bool',
                'different',
                'ghi',
                'newTag',
                'otherNewTag',
            ]);
        });

        it('should support Object.keys() for tags that were deleted from the bot', () => {
            const keys1 = Object.keys(script.raw);
            keys1.sort();

            expect(keys1).toEqual(['abc', 'bool', 'different', 'ghi']);

            script.raw.abc = null;

            const keys2 = Object.keys(script.raw);
            keys2.sort();

            expect(keys2).toEqual(['bool', 'different', 'ghi']);

            delete precalc.tags.bool;

            const keys3 = Object.keys(script.raw);
            keys3.sort();

            expect(keys3).toEqual(['different', 'ghi']);
        });

        it('should get the raw value from the manager', () => {
            const fun = script.raw.fun;
            expect(manager.getRawValue).toHaveBeenCalledWith(precalc, 'fun');
        });

        describe('array', () => {
            let arr: any[];

            beforeEach(() => {
                precalc.tags.arr = precalc.values.arr = arr = ['hello'];
            });

            it('should return the array', () => {
                expect(script.tags.arr).not.toBe(arr);
                expect(script.raw.arr).toBe(arr);
                expect(Array.isArray(script.tags.arr)).toBe(true);
                expect(Array.isArray(script.raw.arr)).toBe(true);
            });

            it('should not support setting an item in an array', () => {
                const ret = (script.raw.arr[0] = 'test');

                const expected = ['test'];
                expect(ret).toEqual('test');
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support pushing an item to an array', () => {
                const ret = script.raw.arr.push('test');

                const expected = ['hello', 'test'];
                expect(ret).toBe(2);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support popping an item from an array', () => {
                const ret = script.raw.arr.pop();

                const expected = [] as any[];
                expect(ret).toEqual('hello');
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support unshifting an item to an array', () => {
                const ret = script.raw.arr.unshift('test1', 'test2');

                const expected = ['test1', 'test2', 'hello'] as any[];
                expect(ret).toBe(3);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support shifting an item from an array', () => {
                const ret = script.raw.arr.shift();

                const expected = [] as any[];
                expect(ret).toEqual('hello');
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support filling an array', () => {
                precalc.tags.arr = precalc.values.arr = [
                    'hello',
                    'test1',
                    'test2',
                ];
                const ret = script.raw.arr.fill(10);

                const expected = [10, 10, 10] as any[];
                expect(ret).toEqual(expected);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support sorting the array', () => {
                precalc.tags.arr = precalc.values.arr = ['zyx', 'lhm', 'abc'];
                const ret = script.raw.arr.sort();

                const expected = ['abc', 'lhm', 'zyx'] as any[];
                expect(ret).toEqual(expected);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support splicing the array', () => {
                precalc.tags.arr = precalc.values.arr = ['zyx', 'lhm', 'abc'];
                const ret = script.raw.arr.splice(1, 1, 'def');

                const expected = ['zyx', 'def', 'abc'] as any[];
                expect(ret).toEqual(['lhm']);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should not support expanding an array by setting the length', () => {
                const ret = (script.raw.arr.length = 5);

                const expected = [
                    'hello',
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                ] as any[];
                expect(ret).toBe(5);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(updateTagMock).not.toBeCalledWith(
                    precalc,
                    'arr',
                    expected
                );
            });

            it('should unwrap the array proxy when saving to another tag', () => {
                const abc = [123];
                script.raw.arr = abc;
                script.raw.other = script.tags.arr;

                const expected = [123];
                expect(script.tags.other).toEqual(expected);
                expect(script.raw.other).toEqual(expected);

                expect(script.changes.other).toBe(abc);
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });
        });
    });

    describe('signatures', () => {
        it('should contain the signatures from the precalculated bot', () => {
            expect(script.signatures).toEqual({
                ...precalc.signatures,
            });
        });

        it('should be able to enumerate the signatures on the bot', () => {
            let objectTags = Object.keys(script.signatures);
            let forTags = [] as string[];
            for (let tag in script.signatures) {
                forTags.push(tag);
            }

            expect(objectTags).toEqual(forTags);
            expect(forTags).toEqual(['sig1', 'sig2', 'sig3']);
        });

        it('should not allow changing signatures', () => {
            script.signatures.sig1 = 'wrong';
            expect(script.signatures.sig1).toEqual('abc');
        });

        it('should not allow adding signatures', () => {
            script.signatures.newSig = 'def';
            expect(script.signatures.newSig).toBeUndefined();
        });

        it('should not allow deleting signatures', () => {
            delete script.signatures.sig1;
            expect(script.signatures.sig1).toBe('abc');
        });
    });

    describe('listeners', () => {
        it('should use the return value from the getListener() function', () => {
            let func = () => {};
            getListenerMock.mockReturnValueOnce(func);
            const listener = script.listeners.abc;
            expect(listener).toBe(func);
        });
    });

    describe('masks', () => {
        it('should set the tag mask for the given tag in the tempLocal space by default', () => {
            script.masks.abc = true;

            expect(script.masks.abc).toEqual(true);
            expect(script.maskChanges).toEqual({
                tempLocal: {
                    abc: true,
                },
            });
        });

        it('should get the tag mask from the manager', () => {
            precalc.masks = {
                test: {
                    abc: true,
                },
            };

            expect(script.masks.abc).toEqual(true);
        });

        it('should suppport Object.keys() for tags added after the runtime bot was created', () => {
            precalc.masks = {
                shared: {
                    abc: 'def',
                },
                tempLocal: {
                    ghi: 'jkl',
                },
            };
            expect(Object.keys(script.masks)).toEqual(['abc', 'ghi']);
        });

        it('should support Object.keys() for tags that were deleted from the bot', () => {
            precalc.masks = {
                shared: {
                    abc: 'def',
                    different: 123,
                },
                tempLocal: {
                    ghi: 'jkl',
                    bool: true,
                },
            };
            const keys1 = Object.keys(script.masks);
            keys1.sort();

            expect(keys1).toEqual(['abc', 'bool', 'different', 'ghi']);

            script.masks.abc = null;

            const keys2 = Object.keys(script.masks);
            keys2.sort();

            expect(keys2).toEqual(['bool', 'different', 'ghi']);

            delete precalc.masks.tempLocal.bool;

            const keys3 = Object.keys(script.masks);
            keys3.sort();

            expect(keys3).toEqual(['different', 'ghi']);
        });

        it('should support the delete keyword', () => {
            precalc.masks = {
                shared: {
                    abc: 'def',
                },
                tempLocal: {
                    abc: 'jkl',
                },
                other: {
                    different: 123,
                },
            };

            delete script.masks.abc;

            expect(script.masks.abc).toBeUndefined();
            expect(script.maskChanges).toEqual({
                shared: {
                    abc: null,
                },
                tempLocal: {
                    abc: null,
                },
            });
            expect(manager.updateTagMask).toHaveBeenCalledWith(
                precalc,
                'abc',
                ['shared', 'tempLocal'],
                null
            );
        });

        describe('array', () => {
            beforeEach(() => {
                precalc.masks = {
                    tempLocal: {
                        arr: ['hello'],
                    },
                };
            });

            it('should return an array-like object', () => {
                expect(script.masks.arr).toEqual(['hello']);
                expect(Array.isArray(script.masks.arr)).toBe(true);
            });

            it('should support setting an item in an array', () => {
                const ret = (script.masks.arr[0] = 'test');

                const expected = ['test'];
                expect(ret).toEqual('test');
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support pushing an item to an array', () => {
                const ret = script.masks.arr.push('test');

                const expected = ['hello', 'test'];
                expect(ret).toBe(2);
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support popping an item from an array', () => {
                const ret = script.masks.arr.pop();

                const expected = [] as any[];
                expect(ret).toEqual('hello');
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support unshifting an item to an array', () => {
                const ret = script.masks.arr.unshift('test1', 'test2');

                const expected = ['test1', 'test2', 'hello'] as any[];
                expect(ret).toBe(3);
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support shifting an item from an array', () => {
                const ret = script.masks.arr.shift();

                const expected = [] as any[];
                expect(ret).toEqual('hello');
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support filling an array', () => {
                precalc.masks = {
                    tempLocal: {
                        arr: ['hello', 'test1', 'test2'],
                    },
                };
                const ret = script.masks.arr.fill(10);

                const expected = [10, 10, 10] as any[];
                expect(ret).toEqual(expected);
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support sorting the array', () => {
                precalc.masks = {
                    tempLocal: {
                        arr: ['zyx', 'lhm', 'abc'],
                    },
                };
                const ret = script.masks.arr.sort();

                const expected = ['abc', 'lhm', 'zyx'] as any[];
                expect(ret).toEqual(expected);
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support splicing the array', () => {
                precalc.masks = {
                    tempLocal: {
                        arr: ['zyx', 'lhm', 'abc'],
                    },
                };
                const ret = script.masks.arr.splice(1, 1, 'def');

                const expected = ['zyx', 'def', 'abc'] as any[];
                expect(ret).toEqual(['lhm']);
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support expanding an array by setting the length', () => {
                const ret = (script.masks.arr.length = 5);

                const expected = [
                    'hello',
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                ] as any[];
                expect(ret).toBe(5);
                expect(script.masks.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should support editing an array that is shared between masks and tags', () => {
                const arr = ['hello'];
                precalc.masks = {
                    tempLocal: {
                        arr,
                    },
                };
                precalc.values.arr = precalc.tags.arr = arr;

                const ret1 = script.tags.arr.push('test1');
                const ret2 = script.masks.arr.push('test2');

                const expected = ['hello', 'test1', 'test2'];
                expect(ret1).toBe(2);
                expect(ret2).toBe(3);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toEqual(expected);
                expect(script.masks.arr).toEqual(expected);
                expect(script.changes.arr).toEqual(expected);
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).toBeCalledWith(precalc, 'arr', expected);
            });

            it('should not edit an array that is only in masks but surfaced through tags', () => {
                const arr = ['hello'];
                precalc.masks = {
                    tempLocal: {
                        arr,
                    },
                };
                precalc.values.arr = arr;

                const ret1 = script.tags.arr.push('test1');
                const ret2 = script.masks.arr.push('test2');

                const expected = ['hello', 'test1', 'test2'];
                expect(ret1).toBe(2);
                expect(ret2).toBe(3);
                expect(script.tags.arr).toEqual(expected);
                expect(script.raw.arr).toBeUndefined();
                expect(script.masks.arr).toEqual(expected);
                expect(script.changes.arr).toBeUndefined();
                expect(script.maskChanges).toEqual({
                    tempLocal: {
                        arr: expected,
                    },
                });
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'arr',
                    ['tempLocal'],
                    expected
                );
                expect(updateTagMock).not.toBeCalled();
            });

            it('should unwrap the array proxy when saving to another tag', () => {
                const abc = [123];
                script.tags.arr = abc;
                script.masks.other = script.tags.arr;

                const expected = [123];
                expect(script.masks.other).toEqual(expected);

                expect(script.maskChanges?.tempLocal?.other).toBe(abc);
                expect(updateTagMaskMock).toBeCalledWith(
                    precalc,
                    'other',
                    ['tempLocal'],
                    expected
                );
            });
        });
    });

    describe('clear_changes', () => {
        it('should be able to clear changes from the script bot', () => {
            script.tags.abc = 123;
            script.tags.def = 'hello';
            script.masks.test = 'value';

            expect(script.raw.abc).toEqual(123);

            const changes = script.changes;
            expect(changes).toEqual({
                abc: 123,
                def: 'hello',
            });
            const maskChanges = script.maskChanges;
            expect(maskChanges).toEqual({
                [DEFAULT_TAG_MASK_SPACE]: {
                    test: 'value',
                },
            });

            script[CLEAR_CHANGES_SYMBOL]();

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({});
            expect(script.changes).not.toEqual(changes);
            expect(script.raw.abc).toEqual(123);
            expect(script.raw.def).toEqual('hello');

            script.raw.abc = 456;
            script.masks.test = 'value';
            expect(script.changes).toEqual({
                abc: 456,
            });
            expect(script.maskChanges).toEqual({
                [DEFAULT_TAG_MASK_SPACE]: {
                    test: 'value',
                },
            });
            expect(script.raw.abc).toEqual(456);
        });

        it('should not be enumerable, configurable, or writable', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                script,
                CLEAR_CHANGES_SYMBOL
            );
            expect(descriptor.writable).toBe(false);
            expect(descriptor.enumerable).toBe(false);
            expect(descriptor.configurable).toBe(false);
        });
    });

    describe('set_tag_mask', () => {
        it('should be able to set a tag mask in the specified space', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 123, 'local');

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: 123,
                },
            });
            expect(script.masks.abc).toEqual(123);
        });

        it('should use the default space if no space is specified', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 123);

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                [DEFAULT_TAG_MASK_SPACE]: {
                    abc: 123,
                },
            });
            expect(script.masks.abc).toEqual(123);
        });

        it('should be able to delete a tag mask in the specified space', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def', 'custom');
            script[SET_TAG_MASK_SYMBOL]('abc', 123, 'local');
            script[SET_TAG_MASK_SYMBOL]('abc', null, 'local');

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: null,
                },
                custom: {
                    abc: 'def',
                },
            });
            expect(script.masks.abc).toEqual('def');
        });

        it('should be able to delete the tag mask in all spaces if no space is specified', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def', 'custom');
            script[SET_TAG_MASK_SYMBOL]('abc', 123, 'local');
            script[SET_TAG_MASK_SYMBOL]('abc', null);

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: null,
                },
                custom: {
                    abc: null,
                },
            });
            expect(script.masks.abc).toBeUndefined();
        });

        it('should unwrap the array proxy when saving to another tag', () => {
            const abc = [123];
            script.tags.arr = abc;
            script[SET_TAG_MASK_SYMBOL]('other', script.tags.arr);

            const expected = [123];
            expect(script.masks.other).toEqual(expected);
            expect(script.maskChanges?.tempLocal?.other).toBe(abc);
            expect(updateTagMaskMock).toBeCalledWith(
                precalc,
                'other',
                ['tempLocal'],
                expected
            );
        });
    });

    describe('clear_tag_masks', () => {
        it('should be able to clear tag masks from the given space', () => {
            script[SET_TAG_MASK_SYMBOL]('value', true, 'local');
            script[SET_TAG_MASK_SYMBOL]('abc', 123, 'local');
            script[SET_TAG_MASK_SYMBOL]('other', 'era', 'tempLocal');

            script[CLEAR_TAG_MASKS_SYMBOL]('local');

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: null,
                    value: null,
                },
                tempLocal: {
                    other: 'era',
                },
            });
            expect(script.masks.abc).toBeUndefined();
            expect(script.masks.value).toBeUndefined();
            expect(script.masks.other).toEqual('era');
        });

        it('should be able to clear tag masks from all spaces', () => {
            script[SET_TAG_MASK_SYMBOL]('value', true, 'local');
            script[SET_TAG_MASK_SYMBOL]('abc', 123, 'local');
            script[SET_TAG_MASK_SYMBOL]('other', 'era', 'tempLocal');

            script[CLEAR_TAG_MASKS_SYMBOL]();

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: null,
                    value: null,
                },
                tempLocal: {
                    other: null,
                },
            });
            expect(script.masks.abc).toBeUndefined();
            expect(script.masks.value).toBeUndefined();
            expect(script.masks.other).toBeUndefined();
        });

        it('should work when the bot has no tag masks', () => {
            script[CLEAR_TAG_MASKS_SYMBOL]('local');

            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({});
        });
    });

    describe('edit_tag', () => {
        it('should support editing normal tags', () => {
            script[EDIT_TAG_SYMBOL]('abc', [
                preserve(1),
                insert('111'),
                del(1),
            ]);

            expect(script.tags.abc).toEqual('d111f');
            expect(script.raw.abc).toEqual('d111f');
            expect(script.changes.abc).toEqual(
                remoteEdit(
                    manager.currentVersion.vector,
                    preserve(1),
                    insert('111'),
                    del(1)
                )
            );
        });

        it('should not overwrite tag changes with edits', () => {
            script.tags.abc = 'fun';
            script[EDIT_TAG_SYMBOL]('abc', [
                preserve(1),
                insert('111'),
                del(1),
            ]);

            expect(script.tags.abc).toEqual('f111n');
            expect(script.raw.abc).toEqual('f111n');
            expect(script.changes.abc).toEqual('f111n');
        });

        it('should support multiple tag edits in a row', () => {
            script[EDIT_TAG_SYMBOL]('abc', [
                preserve(1),
                insert('111'),
                del(1),
            ]);

            script[EDIT_TAG_SYMBOL]('abc', [preserve(2), insert('2'), del(1)]);

            expect(script.tags.abc).toEqual('d121f');
            expect(script.raw.abc).toEqual('d121f');
            expect(script.changes.abc).toEqual(
                remoteEdits(
                    manager.currentVersion.vector,
                    [preserve(1), insert('111'), del(1)],
                    [preserve(2), insert('2'), del(1)]
                )
            );
        });
    });

    describe('edit_tag_mask', () => {
        it('should support editing tag masks', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def', 'local');
            script[CLEAR_CHANGES_SYMBOL]();

            script[EDIT_TAG_MASK_SYMBOL](
                'abc',
                [preserve(1), insert('111'), del(1)],
                'local'
            );

            expect(script.masks.abc).toEqual('d111f');
            expect(script.raw.abc).toEqual('def');
            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: remoteEdit(
                        manager.currentVersion.vector,
                        preserve(1),
                        insert('111'),
                        del(1)
                    ),
                },
            });
        });

        it('should not overwrite tag mask changes', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def', 'local');

            script[EDIT_TAG_MASK_SYMBOL](
                'abc',
                [preserve(1), insert('111'), del(1)],
                'local'
            );

            expect(script.masks.abc).toEqual('d111f');
            expect(script.raw.abc).toEqual('def');
            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: 'd111f',
                },
            });
        });

        it('should support multiple tag mask edits in a row', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def', 'local');
            script[CLEAR_CHANGES_SYMBOL]();

            script[EDIT_TAG_MASK_SYMBOL](
                'abc',
                [preserve(1), insert('111'), del(1)],
                'local'
            );

            script[EDIT_TAG_MASK_SYMBOL](
                'abc',
                [preserve(2), insert('2'), del(1)],
                'local'
            );

            expect(script.masks.abc).toEqual('d121f');
            expect(script.raw.abc).toEqual('def');
            expect(script.maskChanges).toEqual({
                local: {
                    abc: remoteEdits(
                        manager.currentVersion.vector,
                        [preserve(1), insert('111'), del(1)],
                        [preserve(2), insert('2'), del(1)]
                    ),
                },
            });
        });

        it('should use the default tag mask space if not specified', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def');
            script[CLEAR_CHANGES_SYMBOL]();

            script[EDIT_TAG_MASK_SYMBOL](
                'abc',
                [preserve(1), insert('111'), del(1)],
                null
            );

            expect(script.masks.abc).toEqual('d111f');
            expect(script.raw.abc).toEqual('def');
            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                [DEFAULT_TAG_MASK_SPACE]: {
                    abc: remoteEdit(
                        manager.currentVersion.vector,
                        preserve(1),
                        insert('111'),
                        del(1)
                    ),
                },
            });
        });

        it('should use the tag mask space that the mask is already defined in if the space is not specified', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def', 'local');
            script[CLEAR_CHANGES_SYMBOL]();

            script[EDIT_TAG_MASK_SYMBOL](
                'abc',
                [preserve(1), insert('111'), del(1)],
                null
            );

            expect(script.masks.abc).toEqual('d111f');
            expect(script.raw.abc).toEqual('def');
            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                local: {
                    abc: remoteEdit(
                        manager.currentVersion.vector,
                        preserve(1),
                        insert('111'),
                        del(1)
                    ),
                },
            });
        });

        it('should use the tag mask space that the highest priority if multiple masks are on the bot and the space is not specified', () => {
            script[SET_TAG_MASK_SYMBOL]('abc', 'def', 'tempLocal');
            script[SET_TAG_MASK_SYMBOL]('abc', 'fun', 'local');
            script[CLEAR_CHANGES_SYMBOL]();

            script[EDIT_TAG_MASK_SYMBOL](
                'abc',
                [preserve(1), insert('111'), del(1)],
                null
            );

            expect(script.masks.abc).toEqual('d111f');
            expect(script.raw.abc).toEqual('def');
            expect(script.changes).toEqual({});
            expect(script.maskChanges).toEqual({
                tempLocal: {
                    abc: remoteEdit(
                        manager.currentVersion.vector,
                        preserve(1),
                        insert('111'),
                        del(1)
                    ),
                },
            });
        });
    });
});

describe('isRuntimeBot()', () => {
    it('should return true if the object has ID, tags, raw, listeners, and changes properties', () => {
        expect(
            isRuntimeBot({
                id: 'test',
                tags: {
                    toJSON: function () {},
                },
                raw: {},
                listeners: {},
                changes: {},
                masks: {},
                maskChanges: {},
            })
        ).toBe(true);

        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function () {},
                },
                raw: {},
                listeners: {},
                changes: {},
                masks: {},
                maskChanges: {},
            })
        ).toBe(true);
    });

    it('should require that the tags property has a toJSON function', () => {
        expect(
            isRuntimeBot({
                id: 'test',
                tags: {},
                raw: {},
                listeners: {},
                changes: {},
                mask: {},
                maskChanges: {},
            })
        ).toBe(false);
    });

    it('should require that the ID is not empty', () => {
        expect(
            isRuntimeBot({
                id: '',
                tags: {
                    toJSON: function () {},
                },
                raw: {},
                listeners: {},
                changes: {},
                mask: {},
                maskChanges: {},
            })
        ).toBe(false);
    });

    it('should require the listeners property', () => {
        expect(
            isRuntimeBot({
                id: 'test',
                tags: {
                    toJSON: function () {},
                },
                raw: {},
                changes: {},
                mask: {},
                maskChanges: {},
            })
        ).toBe(false);
    });

    it('should require the tags property', () => {
        expect(
            isRuntimeBot({
                id: 'false',
                raw: {},
                listeners: {},
                changes: {},
                mask: {},
                maskChanges: {},
            })
        ).toBe(false);
    });

    it('should require the changes property', () => {
        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function () {},
                },
                raw: {},
                listeners: {},
                mask: {},
                maskChanges: {},
            })
        ).toBe(false);
    });

    it('should require the masks property', () => {
        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function () {},
                },
                raw: {},
                listeners: {},
                changes: {},
                maskChanges: {},
            })
        ).toBe(false);
    });

    it('should require the maskChanges property', () => {
        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function () {},
                },
                raw: {},
                listeners: {},
                changes: {},
                masks: {},
            })
        ).toBe(false);
    });

    it('should require the raw property', () => {
        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function () {},
                },
                listeners: {},
                changes: {},
                masks: {},
                maskChanges: {},
            })
        ).toBe(false);
    });

    it('should return false when given null', () => {
        expect(isRuntimeBot(null)).toBe(false);
    });

    it('should return false when given a non-bot object', () => {
        expect(isRuntimeBot({})).toBe(false);
    });

    it('should return false when given a string', () => {
        expect(isRuntimeBot('string')).toBe(false);
    });

    it('should return false when given a number', () => {
        expect(isRuntimeBot(99)).toBe(false);
    });

    it('should return false when given a boolean', () => {
        expect(isRuntimeBot(true)).toBe(false);
    });
});

describe('flattenTagMasks()', () => {
    it('should follow the tag mask space priority list', () => {
        let tagMasks: BotTagMasks = {
            [TEMPORARY_BOT_PARTITION_ID]: {
                abc: 1,
            },
            [COOKIE_BOT_PARTITION_ID]: {
                abc: 2,
                def: 1,
            },
            [TEMPORARY_SHARED_PARTITION_ID]: {
                abc: 3,
                def: 2,
                ghi: 1,
            },
            [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: {
                abc: 4,
                def: 3,
                ghi: 2,
                jkl: 1,
            },
            ['shared']: {
                abc: 5,
                def: 4,
                ghi: 3,
                jkl: 2,
                mno: 1,
            },
            ['admin']: {
                abc: 6,
                def: 5,
                ghi: 4,
                jkl: 3,
                mno: 2,
                pqr: 1,
            },
        };

        const flat = flattenTagMasks(tagMasks);

        expect(flat).toEqual({
            abc: 1,
            def: 1,
            ghi: 1,
            jkl: 1,
            mno: 1,
            pqr: 1,
        });
    });

    it('should return an empty object if given undefined', () => {
        const flat = flattenTagMasks(undefined);

        expect(flat).toEqual({});
    });
});
