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
import type { DenialReason } from '../common';
import type { KnownErrorCodes } from './ErrorCodes';

export type Result<T, E extends ErrorType> = Success<T> | Failure<E>;

export interface SuccessOrError<T, E extends ErrorType> {
    success: boolean;
    value?: T;
    error?: E;
}

export interface Success<T> {
    success: true;
    value: T;
}

export interface Failure<E extends ErrorType> {
    success: false;
    error: E;
}

export type ErrorType = {
    errorCode: string;
    errorMessage: string;
    [key: string]: any;
};

export type MatchErrorCodes<T, E extends ErrorType, U> = {
    success: (data: T) => U;
} & {
    [K in E['errorCode']]: (error: Extract<E, { errorCode: K }>) => U;
};

export type GenericSuccess<T> = T extends object
    ? {
          success: true;
      } & T
    : {
          success: true;
          value: T;
      };

export type GenericFailure<E extends ErrorType> = {
    success: false;
} & E;

export type GenericResult<T, E extends ErrorType> =
    | GenericSuccess<T>
    | GenericFailure<E>;

export type SimpleError = {
    errorCode: KnownErrorCodes;
    errorMessage: string;

    reason?: DenialReason;
    issues?: Zod.ZodIssue[];
};

export interface MultiError<E> {
    errorCode: 'multi_error';
    errorMessage: string;
    errors: E[];
}

export function logErrors(multiError: MultiError<ErrorType>, prefix?: string) {
    logError(multiError, prefix);
    for (let error of multiError.errors) {
        logError(error, '  ' + prefix);
    }
}

export function logError(error: ErrorType, prefix?: string) {
    console.error(
        `${prefix ?? ''} Error: ${error.errorMessage} (${error.errorCode})`
    );
    if (error.reason) {
        console.error(`  ${prefix ?? ''} Reason:`, error.reason);
    }
    if (error.issues) {
        console.error(`  ${prefix ?? ''} Issues:`, error.issues);
    }
}

export function genericResult<T, E extends ErrorType>(
    result: Result<T, E>
): GenericResult<T, E> {
    if (isSuccess(result)) {
        if (typeof result.value === 'object') {
            return {
                success: true,
                ...(result.value ?? {}),
            } as GenericSuccess<T>;
        } else {
            return { success: true, value: result.value } as GenericSuccess<T>;
        }
    } else {
        return {
            success: false,
            ...result.error,
        };
    }
}

export function mapResult<T, E extends ErrorType, U>(
    result: Result<T, E>,
    fn: (value: T) => U
): Result<U, E> {
    return isSuccess(result)
        ? success(fn(result.value))
        : (result as Result<U, E>);
}

export function flatMapResult<T, E extends ErrorType, U, F extends ErrorType>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, F>
): Result<U, E | F> {
    return isSuccess(result) ? fn(result.value) : (result as Result<U, E | F>);
}

export function matchResult<T, U>(
    result: Success<T>,
    cases: { success: (data: T) => U }
): U;
export function matchResult<E extends ErrorType, U>(
    result: Failure<E>,
    cases: {
        [K in E['errorCode']]: (error: Extract<E, { errorCode: K }>) => U;
    }
): U;
export function matchResult<T, E extends ErrorType, U>(
    result: Result<T, E>,
    cases: MatchErrorCodes<T, E, U>
): U;
export function matchResult<T, E extends ErrorType, U>(
    result: Result<T, E>,
    cases: MatchErrorCodes<T, E, U>
): U {
    if (isSuccess(result)) {
        return cases.success(result.value);
    } else {
        const error = result.error;
        const handler = cases[error.errorCode as keyof typeof cases];
        if (handler) {
            return handler(error as any);
        } else {
            throw new Error(`No handler for error code: ${error.errorCode}`);
        }
    }
}

export function success(): Success<void>;
export function success<T>(value: T): Success<T>;
export function success<T = void>(value?: T): Success<T> {
    return R.success(value);
}

export function failure<E extends ErrorType>(error: E): Failure<E> {
    return R.failure(error);
}

export function isSuccess<T, E extends ErrorType>(
    result: Result<T, E>
): result is Success<T> {
    return result.success === true;
}

export function isFailure<T, E extends ErrorType>(
    result: Result<T, E>
): result is Failure<E> {
    return result.success === false;
}

export function unwrap<T, E extends ErrorType>(result: Result<T, E>): T {
    if (isSuccess(result)) {
        return result.value;
    } else {
        throw new Error(`Result is a failure: ${JSON.stringify(result.error)}`);
    }
}

export function logResult<T, E extends ErrorType>(
    result: Result<T, E>,
    message?: string
): Result<T, E> {
    if (isSuccess(result)) {
        console.log(message ?? 'Result:', result.value);
    } else {
        console.error(message ?? 'Error:', result.error);
    }
    return result;
}

export class R<T, E extends ErrorType> implements SuccessOrError<T, E> {
    readonly success: boolean;
    private readonly _data: T | E;

    protected constructor(success: boolean, _data: T | E) {
        this.success = success;
        this._data = _data;
    }

    static success<T>(value: T): Success<T> {
        return new R(true, value) as Success<T>;
    }

    static failure<E extends ErrorType>(error: E): Failure<E> {
        return new R(false, error) as Failure<E>;
    }

    get value(): T {
        return this._data as T;
    }

    get error(): E {
        return this._data as E;
    }

    toString(): string {
        return `Result(${this.success}, ${JSON.stringify(this._data)})`;
    }

    toJSON(): GenericResult<T, E> {
        return genericResult(this);
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.toJSON();
    }
}
