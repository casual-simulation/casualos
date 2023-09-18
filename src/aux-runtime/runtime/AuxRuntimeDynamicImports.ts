import { Interpreter } from '@casual-simulation/js-interpreter';
import {
    DeclarativeEnvironmentRecord,
    DefinePropertyOrThrow,
    Descriptor,
    Value,
} from '@casual-simulation/engine262';
import type { overwriteSymbols } from '@casual-simulation/js-interpreter/InterpreterUtils';

export type InterpreterTypes = {
    overwriteSymbols: typeof overwriteSymbols;
    Interpreter: typeof Interpreter;
    DeclarativeEnvironmentRecord: typeof DeclarativeEnvironmentRecord;
    DefinePropertyOrThrow: typeof DefinePropertyOrThrow;
    Descriptor: typeof Descriptor;
    Value: typeof Value;
};

export const DynamicImports: Omit<InterpreterTypes, 'overwriteSymbols'> = {
    Interpreter,
    DeclarativeEnvironmentRecord,
    DefinePropertyOrThrow,
    Descriptor,
    Value,
};

export async function importInterpreter(): Promise<typeof DynamicImports> {
    return DynamicImports;
}
