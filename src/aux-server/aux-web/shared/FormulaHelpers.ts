import {
    createFormulaLibrary,
    FormulaLibraryOptions,
} from '@casual-simulation/aux-common';
import { typeDefinitionMap } from '@casual-simulation/aux-common/Formulas/formula-lib';
import formulaDefinitions from 'raw-loader!@casual-simulation/aux-common/Formulas/formula-lib.d.ts';
import { keys } from 'lodash';

function typeMap(key: string, obj: any, root: string = ''): string {
    if (typeof obj[key] === 'object') {
        return [
            '{',
            ...keys(obj[key]).map(
                k => `  ${k}: ${typeMap(k, obj[key], key + '.')};`
            ),
            '}',
        ].join('\n');
    } else {
        let replacement = typeDefinitionMap.get(root + key);
        if (replacement) {
            return `typeof ${replacement}`;
        } else {
            return `typeof ${key}`;
        }
    }
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
            ...keys(formulaLib).map(
                k => `type _${k} = ${typeMap(k, formulaLib)};`
            ),
            'declare global {',
            ...keys(formulaLib).map(k => `  const ${k}: _${k};`),
            '}',
        ].join('\n');

    return final;
}
