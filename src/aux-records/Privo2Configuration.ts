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
import { z } from 'zod';

const httpsUrl = z
    .string()
    .url()
    .refine((value) => {
        try {
            const url = new URL(value);
            return (
                url.protocol === 'https:' &&
                !url.username &&
                !url.password &&
                !url.search &&
                !url.hash
            );
        } catch {
            return false;
        }
    }, 'Expected an HTTPS URL without credentials, query, or fragment.');

/** Separate credentials and endpoints from the legacy PRIVO integration. */
export const privo2FeatureIdsSchema = z.object({
    account: z.string().nonempty(),
    projectDevelopment: z.string().nonempty(),
    publishProjects: z.string().nonempty(),
    joinAndCollaborate: z.string().nonempty(),
    buildAIEggs: z.string().nonempty(),
});

export const privo2ConfigurationSchema = z
    .object({
        enabled: z
            .boolean()
            .optional()
            .describe(
                'Whether PRIVO2 login and account operations are enabled. Defaults to false.'
            ),
        redirectUri: z
            .string()
            .url()
            .optional()
            .describe('The registered OIDC callback URL.'),
        credentialRedirectUri: z
            .string()
            .url()
            .optional()
            .describe(
                'The registered URL to return to after credential setup.'
            ),
        featureIds: privo2FeatureIdsSchema
            .optional()
            .describe(
                'PRIVO2 feature identifiers. These are independent of legacy PRIVO feature IDs.'
            ),
        webhookSecret: z
            .string()
            .min(32)
            .optional()
            .describe(
                'The secret sent in the x-privo2-key webhook header. Use separate values for INT and PROD.'
            ),

        consentEndpoint: httpsUrl.describe(
            'The PRIVO2 consent service base URL.'
        ),
        authEndpoint: httpsUrl.describe(
            'The PRIVO2 identity service base URL.'
        ),
        // Explicit because the consent service token proxy is only documented for
        // integrations with PiD/OIDC disabled. Do not infer the IDP token endpoint.
        tokenEndpoint: httpsUrl.describe(
            'The client credentials token endpoint.'
        ),
        serviceIdentifier: z
            .string()
            .trim()
            .min(1)
            .describe('The PRIVO service identifier.'),
        clientId: z.string().min(1).describe('The PRIVO2 client ID.'),
        clientSecret: z.string().min(1).describe('The PRIVO2 client secret.'),
        scope: z
            .string()
            .min(1)
            .prefault('openid')
            .describe('The scopes requested for service access tokens.'),
        timeoutMs: z
            .number()
            .int()
            .positive()
            .max(120_000)
            .prefault(10_000)
            .describe('The timeout in milliseconds for PRIVO2 HTTP requests.'),
    })
    .refine(
        (c) =>
            !c.enabled ||
            !!(
                c.redirectUri &&
                c.credentialRedirectUri &&
                c.featureIds &&
                c.webhookSecret
            ),
        {
            message:
                'Enabled PRIVO2 requires redirectUri, credentialRedirectUri, featureIds and webhookSecret.',
        }
    );

export type Privo2Configuration = z.infer<typeof privo2ConfigurationSchema>;
