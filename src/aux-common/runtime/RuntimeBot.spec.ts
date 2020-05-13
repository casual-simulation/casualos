import { BOT_SPACE_TAG, PrecalculatedBot } from '../bots';
import { AuxGlobalContext, MemoryGlobalContext } from './AuxGlobalContext';
import {
    createRuntimeBot,
    RuntimeBotInterface,
    RuntimeBot,
    RealtimeEditMode,
    CLEAR_CHANGES_SYMBOL,
    isRuntimeBot,
} from './RuntimeBot';
import { TestScriptBotFactory } from './test/TestScriptBotFactory';
import { createCompiledBot, CompiledBot } from './CompiledBot';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';

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
        };
        context = new MemoryGlobalContext(
            version,
            device,
            new TestScriptBotFactory()
        );

        updateTagMock = jest.fn();
        updateTagMock.mockImplementation((bot, tag, value) => {
            bot.values[tag] = value;
            bot.tags[tag] = value;
            return RealtimeEditMode.Immediate;
        });

        getListenerMock = jest.fn(
            (bot: CompiledBot, tag: string) => bot.listeners[tag]
        );

        getRawValueMock = jest.fn((bot: PrecalculatedBot, tag: string) => {
            return bot.tags[tag];
        });
        manager = {
            updateTag: updateTagMock,
            getValue(bot: PrecalculatedBot, tag: string) {
                return bot.values[tag];
            },
            getRawValue: getRawValueMock,
            getListener: getListenerMock,
        };

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
            expect(script.raw.abc).toEqual(null);
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

        it('should Object.keys() for tags that were added after the bot was created', () => {
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
            expect(script.raw.abc).toEqual(null);
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

        it('should get the raw value from the manager', () => {
            const fun = script.raw.fun;
            expect(manager.getRawValue).toHaveBeenCalledWith(precalc, 'fun');
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

    describe('clear_changes', () => {
        it('should be able to clear changes from the script bot', () => {
            script.tags.abc = 123;
            script.tags.def = 'hello';

            expect(script.raw.abc).toEqual(123);

            const changes = script.changes;
            expect(changes).toEqual({
                abc: 123,
                def: 'hello',
            });

            script[CLEAR_CHANGES_SYMBOL]();

            expect(script.changes).toEqual({});
            expect(script.changes).not.toEqual(changes);
            expect(script.raw.abc).toEqual(123);
            expect(script.raw.def).toEqual('hello');

            script.raw.abc = 456;
            expect(script.changes).toEqual({
                abc: 456,
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
});

describe('isRuntimeBot()', () => {
    it('should return true if the object has ID, tags, raw, listeners, and changes properties', () => {
        expect(
            isRuntimeBot({
                id: 'test',
                tags: {
                    toJSON: function() {},
                },
                raw: {},
                listeners: {},
                changes: {},
            })
        ).toBe(true);

        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function() {},
                },
                raw: {},
                listeners: {},
                changes: {},
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
            })
        ).toBe(false);
    });

    it('should require that the ID is not empty', () => {
        expect(
            isRuntimeBot({
                id: '',
                tags: {
                    toJSON: function() {},
                },
                raw: {},
                listeners: {},
                changes: {},
            })
        ).toBe(false);
    });

    it('should require the listeners property', () => {
        expect(
            isRuntimeBot({
                id: 'test',
                tags: {
                    toJSON: function() {},
                },
                raw: {},
                changes: {},
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
            })
        ).toBe(false);
    });

    it('should require the changes property', () => {
        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function() {},
                },
                raw: {},
                listeners: {},
            })
        ).toBe(false);
    });

    it('should require the raw property', () => {
        expect(
            isRuntimeBot({
                id: 'false',
                tags: {
                    test: 'abc',
                    toJSON: function() {},
                },
                listeners: {},
                changes: {},
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
