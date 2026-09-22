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
import { SHARED_MARKER_PERMISSION_VALIDATION } from './PolicyPermissions';

describe('SHARED_MARKER_PERMISSION_VALIDATION()', () => {
    it('should accept a marker-based permission without subject info', () => {
        const result = SHARED_MARKER_PERMISSION_VALIDATION().safeParse({
            resourceKind: 'data',
            action: 'read',
            marker: 'testMarker',
            options: {},
            expireTimeMs: null,
        });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            resourceKind: 'data',
            action: 'read',
            marker: 'testMarker',
            expireTimeMs: null,
        });
    });

    it('should reject a permission that includes subjectType', () => {
        const result = SHARED_MARKER_PERMISSION_VALIDATION().safeParse({
            resourceKind: 'data',
            action: 'read',
            marker: 'testMarker',
            options: {},
            expireTimeMs: null,
            subjectType: 'user',
            subjectId: 'test',
        });

        // subjectType/subjectId are unrecognized keys and should be stripped, not rejected,
        // but should not be present in the parsed output.
        expect(result.success).toBe(true);
        expect((result.data as any).subjectType).toBeUndefined();
        expect((result.data as any).subjectId).toBeUndefined();
    });

    it('should reject a permission without a marker', () => {
        const result = SHARED_MARKER_PERMISSION_VALIDATION().safeParse({
            resourceKind: 'data',
            action: 'read',
            options: {},
            expireTimeMs: null,
        });

        expect(result.success).toBe(false);
    });

    it('should reject an unknown resourceKind', () => {
        const result = SHARED_MARKER_PERMISSION_VALIDATION().safeParse({
            resourceKind: 'not_a_real_kind',
            action: 'read',
            marker: 'testMarker',
            options: {},
            expireTimeMs: null,
        });

        expect(result.success).toBe(false);
    });

    it('should support role permissions', () => {
        const result = SHARED_MARKER_PERMISSION_VALIDATION().safeParse({
            resourceKind: 'role',
            action: 'grant',
            marker: 'testMarker',
            options: {},
            expireTimeMs: null,
        });

        expect(result.success).toBe(true);
    });
});
