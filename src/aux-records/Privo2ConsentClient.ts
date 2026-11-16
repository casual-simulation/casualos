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
import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import { privo2ConfigurationSchema } from './Privo2Configuration';

const identifiersSchema = z.object({
    sid: z.string().min(1),
    eid: z.string().nullish(),
});
const featureSchema = z.object({
    feature_identifier: z.string().min(1),
    // Future states are accepted but never treated as granted.
    state: z.string(),
    collected_at: z.string().nullish(),
});
const featuresSchema = z
    .array(featureSchema)
    .nullish()
    .transform((value) => value ?? []);

export const privo2ConsentSchema = z.object({
    consent_identifier: z.string().min(1),
    principal_identifiers: identifiersSchema,
    granter_identifiers: identifiersSchema,
    state: z.string(),
    features: featuresSchema,
    url: z.string().url().nullish(),
});

export const privo2AccountSchema = z.object({
    sub: z.string().min(1),
    eid: z.string().nullish(),
    given_name: z.string().nullish(),
    email: z.string().nullish(),
    email_verified: z.boolean().nullish(),
    preferred_username: z.string().nullish(),
    display_name: z.string().nullish(),
    features: featuresSchema,
});

const principalSchema = z.object({
    birthdate: z.string().min(1),
    birthdate_precision: z.enum([
        'yyyymmdd',
        'yyyymm',
        'yyyy',
        'age',
        'age_u13',
        'age_o17',
    ]),
    eid: z.string().min(1).optional(),
    sid: z.string().min(1).optional(),
    given_name: z.string().optional(),
    email: z.string().email().optional(),
    display_name: z.string().optional(),
    jurisdiction: z.string().optional(),
});
const granterSchema = z.object({
    eid: z.string().min(1).optional(),
    sid: z.string().min(1).optional(),
    email: z.string().email().optional(),
});
const requestSchema = z.object({
    principal: principalSchema,
    granter: granterSchema.optional(),
    features: z.array(z.string().min(1)).min(1),
    locale: z.string().optional(),
});
export type Privo2ConsentRequest = z.infer<typeof requestSchema>;
export type Privo2Consent = z.infer<typeof privo2ConsentSchema>;
export type Privo2Account = z.infer<typeof privo2AccountSchema>;

/** Only the documented `on` state grants a feature. */
export function getPrivo2FeatureStatuses(
    account: Pick<Privo2Account, 'features'>
) {
    return account.features.map((feature) => ({
        featureId: feature.feature_identifier,
        on: feature.state === 'on',
    }));
}

/** Deliberately excludes Axios request config, response bodies, tokens and PII. */
export class Privo2ApiError extends Error {
    constructor(
        public readonly status?: number,
        public readonly serviceCode?: number
    ) {
        super(
            `PRIVO2 request failed${status ? ` (HTTP ${status})` : ''}${
                serviceCode !== undefined
                    ? ` (service code ${serviceCode})`
                    : ''
            }.`
        );
        this.name = 'Privo2ApiError';
    }
}

/**
 * Consent-service transport, not an implementation of the legacy identity client.
 * Consumers must persist consent_identifier and both returned SIDs before
 * proceeding to credential creation. No automatic retry of side-effecting calls.
 */
export class Privo2ConsentClient {
    private readonly _config: z.infer<typeof privo2ConfigurationSchema>;
    private readonly _http: AxiosInstance;
    private _token: { value: string; expiresAt: number } | undefined;
    private _pendingToken: Promise<string> | undefined;

    constructor(
        config: z.input<typeof privo2ConfigurationSchema>,
        http: AxiosInstance = axios.create()
    ) {
        const parsed = privo2ConfigurationSchema.safeParse(config);
        if (!parsed.success) {
            throw new Error('Invalid PRIVO2 configuration.');
        }
        this._config = parsed.data;
        this._http = http;
    }

    async createConsentRequest(
        request: Privo2ConsentRequest
    ): Promise<Privo2Consent> {
        const parsed = requestSchema.safeParse(request);
        if (!parsed.success) throw new Error('Invalid PRIVO2 consent request.');
        return this._request(
            'POST',
            '/requests',
            privo2ConsentSchema,
            parsed.data
        );
    }

    async getConsent(consentIdentifier: string): Promise<Privo2Consent> {
        return this._request(
            'GET',
            `/consents/${this._segment(consentIdentifier)}`,
            privo2ConsentSchema
        );
    }

    async getAccount(sid: string): Promise<Privo2Account> {
        return this._request(
            'GET',
            `/accounts/sid/${this._segment(sid)}`,
            privo2AccountSchema
        );
    }

    async getAccountByExternalId(eid: string): Promise<Privo2Account> {
        return this._request(
            'GET',
            `/accounts/eid/${this._segment(eid)}`,
            privo2AccountSchema
        );
    }

    async resendConsentRequest(
        consentIdentifier: string
    ): Promise<Privo2Consent> {
        return this._request(
            'PATCH',
            `/requests/${this._segment(consentIdentifier)}`,
            privo2ConsentSchema,
            {}
        );
    }

    async lookupAccount(identifiers: {
        email?: string;
        phone_number?: string;
        eid?: string;
    }): Promise<Privo2Account | null> {
        if (
            !identifiers.email &&
            !identifiers.phone_number &&
            !identifiers.eid
        ) {
            return null;
        }
        return this._request(
            'POST',
            '/lookup',
            privo2AccountSchema.nullable(),
            identifiers
        );
    }

    /** Creates a hosted credential URL after the caller saves the consent IDs. */
    async createCredentialSetup(sid: string, redirectUri?: string) {
        const url = new URL(
            `${this._config.authEndpoint.replace(
                /\/$/,
                ''
            )}/s2s/api/v1.0/${this._segment(
                this._config.serviceIdentifier
            )}/user-account/sid/${this._segment(sid)}`
        );
        if (redirectUri) url.searchParams.set('redirect_uri', redirectUri);
        return this._send(
            'POST',
            url.href,
            z.object({
                url: z
                    .string()
                    .url()
                    .refine((value) => new URL(value).protocol === 'https:'),
                credentials_compliant: z.boolean(),
            })
        );
    }

    private _segment(value: string): string {
        if (!value || value === '.' || value === '..')
            throw new Error('Invalid PRIVO2 identifier.');
        return encodeURIComponent(value);
    }

    private async _request<T>(
        method: 'GET' | 'POST' | 'PATCH',
        path: string,
        schema: z.ZodType<T>,
        data?: unknown
    ): Promise<T> {
        return this._send(
            method,
            `${this._config.consentEndpoint.replace(
                /\/$/,
                ''
            )}/s2s/api/v1.0/${this._segment(
                this._config.serviceIdentifier
            )}${path}`,
            schema,
            data
        );
    }

    private async _send<T>(
        method: 'GET' | 'POST' | 'PATCH',
        url: string,
        schema: z.ZodType<T>,
        data?: unknown
    ): Promise<T> {
        const token = await this._getToken();
        try {
            const response = await this._http.request({
                method,
                url,
                headers: { Authorization: `Bearer ${token}` },
                data,
                timeout: this._config.timeoutMs,
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 300,
            });
            const parsed = schema.safeParse(response.data);
            if (!parsed.success) throw new Privo2ApiError(response.status);
            return parsed.data;
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 401 &&
                this._token?.value === token
            ) {
                this._token = undefined;
            }
            throw this._safeError(error);
        }
    }

    private async _getToken(): Promise<string> {
        if (this._token && this._token.expiresAt > Date.now())
            return this._token.value;
        if (!this._pendingToken) {
            this._pendingToken = this._fetchToken().finally(() => {
                this._pendingToken = undefined;
            });
        }
        return this._pendingToken;
    }

    private async _fetchToken(): Promise<string> {
        try {
            const startedAt = Date.now();
            const response = await this._http.request({
                method: 'POST',
                url: this._config.tokenEndpoint,
                data: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: this._config.clientId,
                    client_secret: this._config.clientSecret,
                    scope: this._config.scope,
                }).toString(),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: this._config.timeoutMs,
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 300,
            });
            const parsed = z
                .object({
                    access_token: z.string().min(1),
                    token_type: z
                        .string()
                        .refine((value) => value.toLowerCase() === 'bearer'),
                    expires_in: z.number().int().positive().nullish(),
                })
                .safeParse(response.data);
            if (!parsed.success) throw new Privo2ApiError(response.status);
            const token = parsed.data;
            // No expiry means no caching. Avoid assuming the PDF's nominal TTL.
            this._token = token.expires_in
                ? {
                      value: token.access_token,
                      expiresAt:
                          startedAt + Math.max(0, token.expires_in - 30) * 1000,
                  }
                : undefined;
            return token.access_token;
        } catch (error) {
            throw this._safeError(error);
        }
    }

    private _safeError(error: unknown): Privo2ApiError {
        if (error instanceof Privo2ApiError) return error;
        if (axios.isAxiosError(error)) {
            const code = error.response?.data?.code;
            return new Privo2ApiError(
                error.response?.status,
                Number.isSafeInteger(code) ? code : undefined
            );
        }
        return new Privo2ApiError();
    }
}
