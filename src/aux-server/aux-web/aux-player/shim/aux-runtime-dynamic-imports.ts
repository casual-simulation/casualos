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
import type { importInterpreter as expectedImportInterpreter } from '@casual-simulation/aux-runtime/runtime/AuxRuntimeDynamicImports';
import {
    INTERPRETER_OBJECT,
    REGULAR_OBJECT,
    IS_PROXY_OBJECT,
    UNCOPIABLE,
} from '@casual-simulation/js-interpreter/InterpreterUtils';
import { BrowserAuxChannel } from '@casual-simulation/aux-vm-browser/vm/BrowserAuxChannel';
/// <reference src="./interpreter.ts" />

// Manually Imports the Interpreter APIs using fetch() and Function(code)().
// We need to load and then execute the script ourselves because non-es6-modules technically don't support the dynamic import() syntax.
// Rollup enforces this limitation, so IIFE formats don't support the dynamic import() syntax.
// Additionally, Firefox doesn't support Web Worker ES6 modules so we can't tell rollup to use ES6 modules for the Web Worker (and therefore get support for dynamic import()),
// so we have to do it ourselves instead.
// This function has to match the exact API that is used in AuxRuntimeDynamicImports.

// TODO: Remove once FireFox supports the dynamic import() API.
export async function importInterpreter(): ReturnType<
    typeof expectedImportInterpreter
> {
    const url = new URL('/interpreter.js', BrowserAuxChannel.defaultHost);
    const response = await fetch(url.href);
    if (
        response.status >= 300 ||
        !response.headers.has('content-type') ||
        (!response.headers
            .get('content-type')
            .startsWith('application/javascript') &&
            !response.headers
                .get('content-type')
                .startsWith('text/javascript') &&
            !response.headers
                .get('content-type')
                .startsWith('application/json') &&
            !response.headers.get('content-type').startsWith('text/json'))
    ) {
        console.error(
            '[aux-runtime-dynamic-imports] Unable to import interpreter!',
            response,
            response.headers.get('content-type')
        );
        throw new Error('Unable to import the interpreter!');
    }
    const script = await response.text();
    Function(script)();

    globalThis.AuxRuntimeDynamicImports.overwriteSymbols(
        INTERPRETER_OBJECT,
        REGULAR_OBJECT,
        IS_PROXY_OBJECT,
        UNCOPIABLE
    );

    return {
        Interpreter: globalThis.AuxRuntimeDynamicImports.Interpreter,
        DeclarativeEnvironmentRecord:
            globalThis.AuxRuntimeDynamicImports.DeclarativeEnvironmentRecord,
        DefinePropertyOrThrow:
            globalThis.AuxRuntimeDynamicImports.DefinePropertyOrThrow,
        Descriptor: globalThis.AuxRuntimeDynamicImports.Descriptor,
        Value: globalThis.AuxRuntimeDynamicImports.Value,
    };
}
