// This file imports all the files that should be included in the API Documentation generation.
export * from '../../../src/aux-common/math/index';
export { DefaultLibrary, createDefaultLibrary, WebhookOptions, WebhookResult, AnimateTagFunctionOptions, Mod, TagFilter, BotFilter, BotFilterFunction } from '../../../src/aux-common/runtime/AuxLibrary';
export { EaseType, EaseMode, Easing } from '../../../src/aux-common/bots/BotEvents';
export { RuntimeBot, Bot, BotTags, BotSpace, ScriptTags, CompiledBotListeners, BotTagMasks, RuntimeBotVars, RuntimeBotLinks, CompiledBotListener, BotsState, PartialBotsState, ParsedBotLink } from '../../../src/aux-common/bots/Bot';