import {
    createFormulaLibrary,
    FormulaLibraryOptions,
} from '@casual-simulation/aux-common';
import formulaDefinitions from 'raw-loader!@casual-simulation/aux-common/Formulas/formula-lib.d.ts';

function typeMap(key: string, obj: any, root: string = ''): string {
    return `typeof _default['${key}']`;
}

/**
 * Calculates the typescript definitions for the formula library.
 * @param options The options to use for the library.
 */
export function calculateFormulaDefinitions(options?: FormulaLibraryOptions) {
    const formulaLib = createFormulaLibrary(options);
    const final =
        formulaDefinitions +
        [
            '\n',
            ...Object.keys(formulaLib).map(
                k => `type _${k} = ${typeMap(k, formulaLib)};`
            ),
            'declare global {',
            ...Object.keys(formulaLib).map(k => `  const ${k}: _${k};`),
            `  const bot: Bot;`,
            `  const tags: BotTags;`,
            `  const raw: BotTags;`,
            `  const creator: Bot;`,
            `  const config: Bot`,
            `  const tagName: string;`,
            `  const configTag: any`,
            '}',
        ].join('\n');

    return final;
}
