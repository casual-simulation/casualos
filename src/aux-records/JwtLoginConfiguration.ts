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

/**
 * The asymmetric JWS algorithms that are supported for JWT logins.
 * Symmetric algorithms (HS256, etc.) are intentionally not supported because the server
 * should only ever need to know the public half of the key.
 */
export const JWT_LOGIN_ALGORITHMS = [
    'RS256',
    'RS384',
    'RS512',
    'PS256',
    'PS384',
    'PS512',
    'ES256',
    'ES384',
    'ES512',
    'EdDSA',
] as const;

export type JwtLoginAlgorithm = (typeof JWT_LOGIN_ALGORITHMS)[number];

export const jwtLoginTrustedKeySchema = z.object({
    id: z
        .string()
        .nonempty()
        .optional()
        .describe(
            'The ID of the key. If specified, then JWTs that include a "kid" header will only be verified using the key with the matching ID. Useful for key rotation.'
        ),
    publicKey: z
        .string()
        .nonempty()
        .describe(
            'The public key that JWTs must be signed with. Either a PEM-encoded SPKI public key ("-----BEGIN PUBLIC KEY-----") or a JSON-encoded JWK.'
        ),
    algorithm: z
        .enum(JWT_LOGIN_ALGORITHMS)
        .describe('The JWS algorithm that the key uses.'),
    issuer: z
        .string()
        .nonempty()
        .optional()
        .describe(
            'The expected "iss" claim. If specified, then JWTs must have a matching "iss" claim.'
        ),
    audience: z
        .string()
        .nonempty()
        .optional()
        .describe(
            'The expected "aud" claim. If specified, then JWTs must have a matching "aud" claim.'
        ),
});

export type JwtLoginTrustedKey = z.infer<typeof jwtLoginTrustedKeySchema>;

export const jwtLoginSchema = z
    .object({
        trustedKeys: z
            .array(jwtLoginTrustedKeySchema)
            .min(1)
            .describe(
                'The public keys that are trusted to sign login JWTs. Any service holding a corresponding private key is able to obtain session keys for any user, so these should be treated with care.'
            ),
        maxTokenAgeSeconds: z
            .number()
            .int()
            .positive()
            .default(300)
            .describe(
                'The maximum age (based on the "iat" claim) in seconds that a JWT can have and still be accepted. JWTs must also include an "exp" claim. Defaults to 300 seconds (5 minutes).'
            ),
        clockToleranceSeconds: z
            .number()
            .int()
            .nonnegative()
            .default(30)
            .describe(
                'The number of seconds of clock skew that is tolerated when validating time-based claims. Defaults to 30 seconds.'
            ),
        sessionLifetimeMs: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional()
            .describe(
                'The lifetime of the sessions that are issued from JWTs in miliseconds. If null, then sessions will not expire. If omitted, then the default session lifetime (2 weeks) will be used.'
            ),
        allowUserCreation: z
            .boolean()
            .default(false)
            .describe(
                'Whether a new user should be created when the JWT specifies an email address that does not belong to an existing user. Defaults to false.'
            ),
    })
    .describe(
        'Options for logging in via JWTs that are signed by a trusted external service. If omitted, then JWT logins will be disabled.'
    );

export type JwtLoginConfiguration = z.infer<typeof jwtLoginSchema>;
