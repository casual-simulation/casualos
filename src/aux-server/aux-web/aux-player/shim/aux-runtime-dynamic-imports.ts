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
