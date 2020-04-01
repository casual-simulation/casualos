import {
    PrecalculatedBot,
    ScriptBot,
    createPrecalculatedBot,
    BOT_SPACE_TAG,
} from '../bots';
import {
    AuxGlobalContext,
    MemoryGlobalContext,
    AuxVersion,
    AuxDevice,
} from './AuxGlobalContext';
import { createScriptBot, ScriptBotManager } from './ScriptBot';

describe('ScriptBot', () => {
    let precalc: PrecalculatedBot;
    let script: ScriptBot;
    let context: AuxGlobalContext;
    let version: AuxVersion;
    let device: AuxDevice;
    let manager: ScriptBotManager<PrecalculatedBot>;

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
        context = new MemoryGlobalContext(version, device);

        manager = {
            updateTag: jest.fn(),
        };

        precalc = createPrecalculatedBot(
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

        script = createScriptBot(precalc, manager, context);
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
            precalc = createPrecalculatedBot('test', {}, undefined);
            script = createScriptBot(precalc, manager, context);
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
            precalc = createPrecalculatedBot('test', {}, undefined);
            script = createScriptBot(precalc, manager, context);
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

        it('should support the delete keyword', () => {
            delete script.raw.abc;
            expect(script.raw.abc).toEqual(null);
            expect(manager.updateTag).toHaveBeenCalledWith(
                precalc,
                'abc',
                null
            );
        });
    });
});
