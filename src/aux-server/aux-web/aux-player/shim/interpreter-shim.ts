import { Interpreter } from '@casual-simulation/js-interpreter';
import { overwriteSymbols } from '@casual-simulation/js-interpreter/InterpreterUtils';
import {
    DeclarativeEnvironmentRecord,
    DefinePropertyOrThrow,
    Descriptor,
    Value,
} from '@casual-simulation/engine262';
import type { InterpreterTypes } from '@casual-simulation/aux-common/runtime/AuxRuntimeDynamicImports';

declare global {
    var AuxRuntimeDynamicImports: InterpreterTypes;
}

globalThis.AuxRuntimeDynamicImports = {
    overwriteSymbols,
    Interpreter,
    DeclarativeEnvironmentRecord,
    DefinePropertyOrThrow,
    Descriptor,
    Value,
};
