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

import { failure, success } from '@casual-simulation/aux-common';
import { mapItem } from './SearchSyncQueue';

describe('SearchSyncQueue', () => {
    describe('mapItem()', () => {
        it('should produce an object that contains only the specified fields', () => {
            const result = mapItem(
                {
                    a: 1,
                    b: 2,
                    c: 3,
                },
                [
                    ['a', 'd'],
                    ['c', 'e'],
                ]
            );

            expect(result).toEqual(
                success({
                    d: 1,
                    e: 3,
                })
            );
        });

        it('should be able to map based on dot notation', () => {
            const result = mapItem(
                {
                    a: {
                        x: 1,
                        y: 2,
                    },
                    b: 2,
                    c: {
                        z: {
                            w: 3,
                        },
                    },
                },
                [
                    ['a.x', 'd'],
                    ['c.z.w', 'e'],
                ]
            );

            expect(result).toEqual(
                success({
                    d: 1,
                    e: 3,
                })
            );
        });

        it('should be able to use $ to refer to the root', () => {
            const result = mapItem(
                {
                    a: {
                        x: 1,
                        y: 2,
                    },
                    b: 2,
                    c: {
                        z: {
                            w: 3,
                        },
                    },
                },
                [
                    ['$.a.x', 'd'],
                    ['$.c.z.w', 'e'],
                ]
            );

            expect(result).toEqual(
                success({
                    d: 1,
                    e: 3,
                })
            );
        });

        it('should be able to map arrays', () => {
            const result = mapItem(
                {
                    a: {
                        x: 1,
                        y: 2,
                    },
                    b: 2,
                    c: [3, 4, 5],
                },
                [
                    ['a.x', 'd'],
                    ['c.1', 'e'],
                ]
            );

            expect(result).toEqual(
                success({
                    d: 1,
                    e: 4,
                })
            );
        });

        it('should fail if the property does not exist', () => {
            const result = mapItem(
                {
                    a: {
                        x: 1,
                        y: 2,
                    },
                    b: 2,
                    c: 3,
                },
                [['a.missing', 'd']]
            );

            expect(result).toEqual(
                failure({
                    errorCode: 'invalid_request',
                    errorMessage: `Property missing. Could not find 'missing' (full path: 'a.missing') on '$.a'`,
                })
            );
        });

        it('should ignore properties if the part ends with ?', () => {
            const result = mapItem(
                {
                    a: {
                        x: 1,
                        y: 2,
                    },
                    b: 2,
                    c: 3,
                },
                [['a.missing?', 'e']]
            );

            expect(result).toEqual(success({}));
        });

        it('should be able to set values by priority', () => {
            const result = mapItem(
                {
                    a: {
                        x: 1,
                        y: 2,
                    },
                    b: 2,
                    c: 3,
                },
                [
                    ['a.missing?', 'e'],
                    ['a.i?', 'e'],
                    ['b?', 'e'],
                ]
            );

            expect(result).toEqual(
                success({
                    e: 2,
                })
            );
        });

        it('should not be able to access the constructor', () => {
            const result = mapItem(
                {
                    a: {
                        x: 1,
                        y: 2,
                    },
                    b: 2,
                    c: 3,
                },
                [
                    ['a.x', 'd'],
                    ['constructor', 'e'],
                ]
            );

            expect(result).toEqual(
                failure({
                    errorCode: 'invalid_request',
                    errorMessage: `Property missing. Could not find 'constructor' (full path: 'constructor') on '$'`,
                })
            );
        });
    });
});
