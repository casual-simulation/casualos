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
import {
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
} from '@casual-simulation/aux-common';
import {
    getPublicMarkerPermission,
    getPublicMarkersPermission,
    getPublicReadPermission,
    getPublicWritePermission,
} from './PolicyStore';

describe('getPublicReadPermission()', () => {
    const allowedResourceKinds = [
        ['data', ['read', 'list']] as const,
        ['file', ['read']] as const,
        ['event', ['count']] as const,
        ['inst', ['read']] as const,
        ['notification', ['read', 'list', 'subscribe']] as const,
        ['purchasableItem', ['read', 'list', 'purchase']] as const,
        ['contract', ['read', 'list']] as const,
    ];

    describe.each(allowedResourceKinds)(
        'when resourceKind is %s',
        (resourceKind, allowedActions) => {
            it.each(allowedActions)('should allow %s action', (action) => {
                const result = getPublicReadPermission(resourceKind, action);

                expect(result).toEqual({
                    resourceKind,
                    action,
                });
            });
        }
    );

    const deniedResourceKinds = [
        ['data', ['create', 'update', 'delete']] as const,
        ['file', ['create', 'update', 'delete', 'list']] as const,
        ['event', ['increment', 'list']] as const,
        [
            'inst',
            ['create', 'update', 'delete', 'list', 'sendAction', 'updateData'],
        ] as const,
        [
            'marker',
            [
                'create',
                'update',
                'delete',
                'read',
                'list',
                'grantPermission',
                'revokePermission',
            ],
        ] as const,
        [
            'role',
            ['create', 'update', 'delete', 'read', 'list', 'grant', 'revoke'],
        ] as const,
        ['purchasableItem', ['create', 'update', 'delete']] as const,
        ['contract', ['create', 'update', 'delete', 'purchase']] as const,
    ];

    describe.each(deniedResourceKinds)(
        'when resourceKind is %s',
        (resourceKind, deniedActions) => {
            it.each(deniedActions)('should allow %s action', (action) => {
                const result = getPublicReadPermission(resourceKind, action);

                expect(result).toBe(null);
            });
        }
    );
});

describe('getPublicWritePermission()', () => {
    const allowedResourceKinds = [
        ['data', ['read', 'create', 'delete', 'update', 'list']] as const,
        ['file', ['read', 'create', 'delete']] as const,
        ['event', ['count', 'increment']] as const,
        [
            'inst',
            ['read', 'create', 'updateData', 'sendAction', 'delete'],
        ] as const,
        ['purchasableItem', ['read', 'list', 'purchase']] as const,
        ['contract', ['read', 'list', 'purchase']] as const,
    ];

    describe.each(allowedResourceKinds)(
        'when resourceKind is %s',
        (resourceKind, allowedActions) => {
            it.each(allowedActions)('should allow %s action', (action) => {
                const result = getPublicWritePermission(resourceKind, action);

                expect(result).toEqual({
                    resourceKind,
                    action,
                });
            });
        }
    );

    const deniedResourceKinds = [
        ['file', ['update', 'list']] as const,
        ['event', ['list']] as const,
        ['inst', ['update', 'list']] as const,
        [
            'marker',
            [
                'create',
                'update',
                'delete',
                'read',
                'list',
                'grantPermission',
                'revokePermission',
            ],
        ] as const,
        [
            'role',
            ['create', 'update', 'delete', 'read', 'list', 'grant', 'revoke'],
        ] as const,
        ['purchasableItem', ['create', 'update', 'delete']] as const,
    ];

    describe.each(deniedResourceKinds)(
        'when resourceKind is %s',
        (resourceKind, deniedActions) => {
            it.each(deniedActions)('should deny %s action', (action) => {
                const result = getPublicWritePermission(resourceKind, action);

                expect(result).toBe(null);
            });
        }
    );
});

describe('getPublicMarkerPermission()', () => {
    it('should return a permission for publicRead markers', () => {
        const result = getPublicMarkerPermission(
            PUBLIC_READ_MARKER,
            'data',
            'read'
        );

        expect(result).toEqual({
            resourceKind: 'data',
            action: 'read',
        });
    });

    it('should return a permission for publicWrite markers', () => {
        const result = getPublicMarkerPermission(
            PUBLIC_WRITE_MARKER,
            'data',
            'update'
        );

        expect(result).toEqual({
            resourceKind: 'data',
            action: 'update',
        });
    });

    it('should return null if given a non-public marker', () => {
        const result = getPublicMarkerPermission('secret', 'data', 'update');

        expect(result).toEqual(null);
    });
});

describe('getPublicMarkersPermission()', () => {
    it('should return a permission for publicRead markers', () => {
        const result = getPublicMarkersPermission(
            [PUBLIC_READ_MARKER],
            'data',
            'read'
        );

        expect(result).toEqual({
            marker: PUBLIC_READ_MARKER,
            resourceKind: 'data',
            action: 'read',
        });
    });

    it('should return a permission for publicWrite markers', () => {
        const result = getPublicMarkersPermission(
            [PUBLIC_WRITE_MARKER],
            'data',
            'update'
        );

        expect(result).toEqual({
            marker: PUBLIC_WRITE_MARKER,
            resourceKind: 'data',
            action: 'update',
        });
    });

    it('should return the first permission from the list of markers', () => {
        const result = getPublicMarkersPermission(
            [PUBLIC_READ_MARKER, PUBLIC_WRITE_MARKER],
            'data',
            'update'
        );

        expect(result).toEqual({
            marker: PUBLIC_WRITE_MARKER,
            resourceKind: 'data',
            action: 'update',
        });
    });

    it('should return null if given a non-public marker', () => {
        const result = getPublicMarkersPermission(['secret'], 'data', 'update');

        expect(result).toEqual(null);
    });
});
