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
import { getBaseOrigin, getVMOrigin } from './AuxVMUtils';

console.warn = jest.fn();

describe('getVMOrigin()', () => {
    it('should return the configured origin if it is set', () => {
        const result = getVMOrigin(
            'configuredOrigin',
            'defaultOrigin',
            'instId'
        );
        expect(result).toEqual('configuredOrigin');
    });

    it('should return the default origin if no configured origin is provided', () => {
        const result = getVMOrigin(null, 'defaultOrigin', 'instId');
        expect(result).toEqual('defaultOrigin');
    });

    it('should interpolate the instId into the configured origin if possible', () => {
        const result = getVMOrigin(
            'configuredOrigin/{{inst}}',
            'defaultOrigin',
            'instId'
        );
        expect(result).toEqual('configuredOrigin/instId');
    });

    it('should replace non-alphanumeric characters with dashes', () => {
        const result = getVMOrigin(
            'configuredOrigin/{{inst}}',
            'defaultOrigin',
            '&instId$%.'
        );
        expect(result).toEqual('configuredOrigin/-instId---');
    });
});

describe('getBaseOrigin()', () => {
    it('should return the base origin of the origin', () => {
        const result = getBaseOrigin('https://test.com');
        expect(result).toEqual('https://test.com');
    });

    it('should work with simple domains', () => {
        const result = getBaseOrigin('https://localhost');
        expect(result).toEqual('https://localhost');
    });

    it('should support port numbers', () => {
        const result = getBaseOrigin('https://localhost:1234');
        expect(result).toEqual('https://localhost:1234');
    });

    it('should remove only the top subdomains from the origin', () => {
        const result = getBaseOrigin('https://abc.def.ghi.test.com');
        expect(result).toEqual('https://def.ghi.test.com');
    });

    it('should return the origin if it is not a valid URL', () => {
        const result = getBaseOrigin('not-a-valid-url');
        expect(result).toEqual('not-a-valid-url');
    });
});
