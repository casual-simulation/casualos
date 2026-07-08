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
import z from 'zod';

export const openIdProviderSchema = z.object({
    id: z.string().nonempty().describe('The unique ID of the provider.'),
    name: z
        .string()
        .nonempty()
        .describe('The human-readable name of the provider.'),
    discoveryUri: z
        .string()
        .nonempty()
        .describe(
            'The URI that OpenID configuration info should be discovered from.'
        ),
    redirectUri: z
        .string()
        .nonempty()
        .describe('The URI that users should be redirected to after a login.'),
    clientId: z
        .string()
        .nonempty()
        .describe('The Client ID that should be used.'),
    clientSecret: z
        .string()
        .nonempty()
        .describe('The client secret that should be used.'),
    requestScopes: z
        .array(z.string().nonempty())
        .optional()
        .prefault(['openid', 'email', 'profile'])
        .describe('The scopes that should be requested during login.'),
});

export type OpenIDProviderConfiguration = z.infer<typeof openIdProviderSchema>;

export const openIdSchema = z.object({
    providers: z
        .array(openIdProviderSchema)
        .optional()
        .prefault([])
        .describe('The list of custom OpenID providers that are configured.'),
});

export type OpenIDConfiguration = z.infer<typeof openIdSchema>;

export function parseOpenIDConfiguration(
    config: any,
    defaultConfig: OpenIDConfiguration
): OpenIDConfiguration {
    if (config) {
        const result = openIdSchema.safeParse(config);
        if (result.success) {
            return result.data as OpenIDConfiguration;
        } else {
            console.error(
                '[OpenIDConfiguration] Invalid openid config',
                result
            );
        }
    }
    return defaultConfig;
}
