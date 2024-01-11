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
            'policy',
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
