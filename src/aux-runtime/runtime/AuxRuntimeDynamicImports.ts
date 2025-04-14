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
