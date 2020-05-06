import {
    Bot,
    PrecalculatedBot,
    BotTags,
    BotsState,
    ScriptBot,
    PrecalculatedTags,
    ScriptTags,
    BOT_SPACE_TAG,
} from './Bot';
import { BotCalculationContext } from './BotCalculationContext';
import { SandboxLibrary, SandboxFactory } from '../Formulas/Sandbox';
import formulaLib from '../Formulas/formula-lib';
import { merge } from '../utils';
import { BotLookupTableHelper } from './BotLookupTableHelper';

export interface FormulaLibraryOptions {
    config?: {};
    version?: {
        hash: string;
        version: string;
        major: number;
        minor: number;
        patch: number;
    };
    device?: {
        supportsAR: boolean;
        supportsVR: boolean;
    };
}

/**
 * Creates a new formula library.
 */
export function createFormulaLibrary(
    options?: FormulaLibraryOptions
): SandboxLibrary {
    const defaultOptions: FormulaLibraryOptions = {
        config: {},
        version: {
            hash: null,
            version: null,
            major: null,
            minor: null,
            patch: null,
        },
        device: { supportsAR: null, supportsVR: null },
    };
    const finalOptions = merge(defaultOptions, options || {});

    return merge(formulaLib, {
        player: {
            version: () => finalOptions.version,
            device: () => finalOptions.device,
        },
    });
}

export function createPrecalculatedContext(
    objects: Bot[]
): BotCalculationContext {
    const context = {
        objects: objects,
        cache: new Map(),
        lookup: new BotLookupTableHelper(),
    };
    return context;
}
