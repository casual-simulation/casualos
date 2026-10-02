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
import { openIdProviderSchema } from './OpenIDConfiguration';

describe('openIdProviderSchema', () => {
    const base = {
        id: 'test',
        name: 'Test',
        discoveryUri: 'https://example.com',
        redirectUri: 'https://example.com/callback',
        clientId: 'clientId',
    };

    it('should require a clientSecret by default', () => {
        const result = openIdProviderSchema.safeParse(base);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['clientSecret']);
    });

    it.each(['client_secret_basic', 'client_secret_post'] as const)(
        'should require a clientSecret when using %s',
        (method) => {
            const result = openIdProviderSchema.safeParse({
                ...base,
                tokenEndpointAuthMethod: method,
            });
            expect(result.success).toBe(false);

            const withSecret = openIdProviderSchema.safeParse({
                ...base,
                clientSecret: 'secret',
                tokenEndpointAuthMethod: method,
            });
            expect(withSecret.success).toBe(true);
        }
    );

    it('should not require a clientSecret when using none', () => {
        const result = openIdProviderSchema.safeParse({
            ...base,
            tokenEndpointAuthMethod: 'none',
        });
        expect(result.success).toBe(true);
        expect(result.data?.tokenEndpointAuthMethod).toBe('none');
    });

    it('should reject unknown auth methods', () => {
        const result = openIdProviderSchema.safeParse({
            ...base,
            clientSecret: 'secret',
            tokenEndpointAuthMethod: 'private_key_jwt',
        });
        expect(result.success).toBe(false);
    });
});
