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
import type { ErrorType, Failure, Result, Success } from './Result';
import {
    failure,
    flatMapResult,
    genericResult,
    mapResult,
    matchResult,
    success,
} from './Result';

describe('Result', () => {
    it('should be able to represent a successful result', () => {
        const result = success('Success!');
        expect(result.success).toBe(true);
        expect(result.value).toBe('Success!');
    });

    it('should be able to represent a failure', () => {
        const result = failure({
            errorCode: 'not_supported',
            errorMessage: 'This operation is not supported.',
            abc: 'def',
        });
        expect(result.success).toBe(false);
        expect(result.error).toEqual({
            errorCode: 'not_supported',
            errorMessage: 'This operation is not supported.',
            abc: 'def',
        });
    });

    it('should be able to map successful results', () => {
        const result = success('Success!');
        const mappedResult = mapResult(result, (data) => data.toUpperCase());
        expect(mappedResult.success).toBe(true);
        expect((mappedResult as Success<string>).value).toBe('SUCCESS!');
    });

    it('should be able to map failure results', () => {
        const result: Result<string, any> = failure({
            errorCode: 'not_supported',
            errorMessage: 'This operation is not supported.',
            abc: 'def',
        });
        const mappedResult = mapResult<string, ErrorType, string>(
            result,
            (data) => data.toUpperCase()
        );
        expect(mappedResult.success).toBe(false);
        expect((mappedResult as Failure<any>).error).toEqual({
            errorCode: 'not_supported',
            errorMessage: 'This operation is not supported.',
            abc: 'def',
        });
    });

    it('should be able to flatMap successful results', () => {
        const result = success('Success!');
        const flatMappedResult = flatMapResult(result, (data) =>
            success(data.toUpperCase())
        );
        expect(flatMappedResult.success).toBe(true);
        expect((flatMappedResult as Success<string>).value).toBe('SUCCESS!');
    });

    it('should be able to flatMap failure results', () => {
        const result: Result<string, any> = failure({
            errorCode: 'not_supported',
            errorMessage: 'This operation is not supported.',
            abc: 'def',
        });
        const flatMappedResult = flatMapResult(result, (data: string) =>
            success(data.toUpperCase())
        );
        expect(flatMappedResult.success).toBe(false);
        expect((flatMappedResult as Failure<any>).error).toEqual({
            errorCode: 'not_supported',
            errorMessage: 'This operation is not supported.',
            abc: 'def',
        });
    });

    it('should be able to pattern match successful results', () => {
        const result = success('Success!');
        const matchedResult = matchResult(result, {
            success: (data) => `Result: ${data}`,
        });
        expect(matchedResult).toBe('Result: Success!');
    });

    it('should be able to pattern match failure results', () => {
        type FailureData =
            | { errorCode: 'Test1'; errorMessage: string }
            | { errorCode: 'Test2'; errorMessage: string };

        const result = failure<FailureData>({
            errorCode: 'Test2',
            errorMessage: 'This operation is not supported.',
        });
        const matchedResult = matchResult(result, {
            success: (data) => `Result: ${data}`,
            Test1: (data) => `Test1: ${data.errorMessage}`,
            Test2: (data) => `Test2: ${data.errorMessage}`,
        });
        expect(matchedResult).toBe('Test2: This operation is not supported.');
    });

    it('should be able to get a generic result from a success', () => {
        const result = success('Success!');
        const gResult = genericResult(result);
        expect(gResult).toEqual({
            success: true,
            value: 'Success!',
        });
    });

    it('should be able to get a generic result from a failure', () => {
        const result = failure({
            errorCode: 'error_code',
            errorMessage: 'error_message',
        });
        const gResult = genericResult(result);
        expect(gResult).toEqual({
            success: false,
            errorCode: 'error_code',
            errorMessage: 'error_message',
        });
    });

    it('should be able to render a success to a string', () => {
        const result = success('Success!');
        const str = result.toString();
        expect(str).toBe('Result(true, "Success!")');
    });
});
