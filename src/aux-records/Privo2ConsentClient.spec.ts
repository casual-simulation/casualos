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
import {
    Privo2ApiError,
    Privo2ConsentClient,
    getPrivo2FeatureStatuses,
} from './Privo2ConsentClient';
import { privo2ConfigurationSchema } from './Privo2Configuration';

jest.unmock('axios');

describe('Privo2ConsentClient', () => {
    const config = {
        consentEndpoint: 'https://consent.example.com/',
        authEndpoint: 'https://idp.example.com',
        tokenEndpoint: 'https://idp.example.com/token',
        serviceIdentifier: 'test-service',
        clientId: 'test-client',
        clientSecret: 'test-secret',
    };
    const consent = {
        consent_identifier: 'consent-1',
        principal_identifiers: { sid: 'child-1' },
        granter_identifiers: { sid: 'parent-1' },
        state: 'pending',
    };
    let request: jest.Mock;
    let client: Privo2ConsentClient;

    beforeEach(() => {
        request = jest.fn().mockImplementation(async (req) => ({
            status: 200,
            data:
                req.url === config.tokenEndpoint
                    ? {
                          access_token: 'test-token',
                          token_type: 'Bearer',
                          expires_in: 1800,
                      }
                    : { sub: 'child-1' },
        }));
        client = new Privo2ConsentClient(config, {
            request,
        } as unknown as AxiosInstance);
    });

    afterEach(() => jest.restoreAllMocks());

    it('uses a separate token endpoint, form credentials and configured timeout', async () => {
        await client.getAccount('child-1');
        const token = request.mock.calls[0][0];
        expect(token.url).toBe(config.tokenEndpoint);
        expect(Object.fromEntries(new URLSearchParams(token.data))).toEqual({
            grant_type: 'client_credentials',
            client_id: 'test-client',
            client_secret: 'test-secret',
            scope: 'openid',
        });
        expect(token.timeout).toBe(10000);
        expect(token.maxRedirects).toBe(0);
        expect(request.mock.calls[1][0]).toMatchObject({
            method: 'GET',
            url: 'https://consent.example.com/s2s/api/v1.0/test-service/accounts/sid/child-1',
            headers: { Authorization: 'Bearer test-token' },
            maxRedirects: 0,
        });
    });

    it('shares an in-flight token request and caches until the expiry margin', async () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
        await Promise.all([client.getAccount('a'), client.getAccount('b')]);
        expect(
            request.mock.calls.filter(
                ([req]) => req.url === config.tokenEndpoint
            )
        ).toHaveLength(1);
        now.mockReturnValue(100000 + 1770000);
        await client.getAccount('c');
        expect(
            request.mock.calls.filter(
                ([req]) => req.url === config.tokenEndpoint
            )
        ).toHaveLength(2);
    });

    it('does not reuse tokens without an expiry', async () => {
        request.mockResolvedValueOnce({
            status: 200,
            data: { access_token: 'token', token_type: 'Bearer' },
        });
        await client.getAccount('a');
        await client.getAccount('b');
        expect(
            request.mock.calls.filter(
                ([req]) => req.url === config.tokenEndpoint
            )
        ).toHaveLength(2);
    });

    it('retains all three identifiers from a consent creation response', async () => {
        request
            .mockResolvedValueOnce({
                status: 200,
                data: { access_token: 'token', token_type: 'Bearer' },
            })
            .mockResolvedValueOnce({
                status: 200,
                data: { ...consent, future_field: true },
            });
        const body = {
            principal: {
                birthdate: '01/01/2015',
                birthdate_precision: 'yyyymmdd' as const,
            },
            granter: { email: 'parent@example.com' },
            features: ['account'],
        };
        expect(await client.createConsentRequest(body)).toEqual({
            ...consent,
            features: [],
        });
        expect(request.mock.calls[1][0]).toMatchObject({
            method: 'POST',
            data: body,
        });
    });

    it('rejects malformed creation requests before requesting a token', async () => {
        await expect(
            client.createConsentRequest({
                principal: { birthdate: '', birthdate_precision: 'yyyymmdd' },
                features: [],
            })
        ).rejects.toThrow('Invalid PRIVO2 consent request');
        expect(request).not.toHaveBeenCalled();
    });

    it('resends using the consent ID, not the principal/parent SIDs', async () => {
        await client.getAccount('a');
        request.mockResolvedValueOnce({ status: 200, data: consent });
        await client.resendConsentRequest('consent-1');
        expect(request.mock.calls[2][0]).toMatchObject({
            method: 'PATCH',
            url: 'https://consent.example.com/s2s/api/v1.0/test-service/requests/consent-1',
            data: {},
        });
    });

    it('creates credentials through the IDP with an encoded redirect query', async () => {
        await client.getAccount('a');
        request.mockResolvedValueOnce({
            status: 200,
            data: {
                url: 'https://idp.example.com/setup/one-time',
                credentials_compliant: false,
            },
        });
        expect(
            await client.createCredentialSetup(
                'child-1',
                'https://ab1.example.com/login?from=signup'
            )
        ).toEqual({
            url: 'https://idp.example.com/setup/one-time',
            credentials_compliant: false,
        });
        const call = request.mock.calls[2][0];
        const url = new URL(call.url);
        expect(url.origin).toBe('https://idp.example.com');
        expect(url.pathname).toBe(
            '/s2s/api/v1.0/test-service/user-account/sid/child-1'
        );
        expect(url.searchParams.get('redirect_uri')).toBe(
            'https://ab1.example.com/login?from=signup'
        );
        expect(call.method).toBe('POST');
        expect(call.headers.Authorization).toBe('Bearer test-token');
        expect(call.data).toBeUndefined();
    });

    it('rejects insecure credential setup URLs', async () => {
        await client.getAccount('a');
        request.mockResolvedValueOnce({
            status: 200,
            data: {
                url: 'http://idp.example.com/setup',
                credentials_compliant: false,
            },
        });
        await expect(client.createCredentialSetup('a')).rejects.toThrow(
            Privo2ApiError
        );
    });

    it('encodes external identifiers as one URL segment', async () => {
        await client.getAccountByExternalId('a/b?c#d');
        expect(
            request.mock.calls[1][0].url.endsWith('/accounts/eid/a%2Fb%3Fc%23d')
        ).toBe(true);
    });

    it.each(['', '.', '..'])(
        'rejects unsafe path identifier %j',
        async (sid) => {
            await expect(client.getAccount(sid)).rejects.toThrow(
                'Invalid PRIVO2 identifier'
            );
            expect(request).not.toHaveBeenCalled();
        }
    );

    it.each([
        'off',
        'pending',
        'declined',
        'revoked',
        'expired',
        'future-state',
    ])('does not grant features in state %s', (state) => {
        expect(
            getPrivo2FeatureStatuses({
                features: [{ feature_identifier: 'publish', state }],
            })
        ).toEqual([{ featureId: 'publish', on: false }]);
    });

    it('grants only the exact on state', () => {
        expect(
            getPrivo2FeatureStatuses({
                features: [{ feature_identifier: 'publish', state: 'on' }],
            })
        ).toEqual([{ featureId: 'publish', on: true }]);
    });

    it('treats omitted feature lists as no permissions', async () => {
        expect((await client.getAccount('a')).features).toEqual([]);
    });

    it('rejects malformed success bodies without exposing their contents', async () => {
        await client.getAccount('a');
        request.mockResolvedValueOnce({
            status: 200,
            data: { email: 'private@example.com' },
        });
        await expect(client.getAccount('a')).rejects.toThrow(
            new Privo2ApiError(200)
        );
    });

    it('redacts HTTP failures and never retries consent creation automatically', async () => {
        await client.getAccount('a');
        request.mockRejectedValueOnce(
            new axios.AxiosError(
                'private response',
                'ERR_BAD_REQUEST',
                undefined,
                undefined,
                {
                    status: 470,
                    data: { code: 915, msg: 'private@example.com' },
                    statusText: '',
                    headers: {},
                    config: {} as any,
                }
            )
        );
        const pending = client.createConsentRequest({
            principal: {
                birthdate: '01/01/2000',
                birthdate_precision: 'yyyymmdd',
            },
            features: ['account'],
        });
        await expect(pending).rejects.toThrow(new Privo2ApiError(470, 915));
        expect(request).toHaveBeenCalledTimes(3);
    });

    it('invalidates a rejected token for the next call without replaying the failed call', async () => {
        await client.getAccount('a');
        request.mockRejectedValueOnce(
            new axios.AxiosError('unauthorized', '', undefined, undefined, {
                status: 401,
                data: {},
                headers: {},
                config: {} as any,
                statusText: '',
            })
        );
        await expect(client.getAccount('b')).rejects.toThrow(Privo2ApiError);
        expect(request).toHaveBeenCalledTimes(3);
        await client.getAccount('c');
        expect(
            request.mock.calls.filter(
                ([req]) => req.url === config.tokenEndpoint
            )
        ).toHaveLength(2);
    });

    it('can retry token acquisition after a failed request', async () => {
        request.mockRejectedValueOnce(new Error('secret network detail'));
        await expect(client.getAccount('a')).rejects.toThrow(
            'PRIVO2 request failed.'
        );
        await expect(client.getAccount('a')).resolves.toMatchObject({
            sub: 'child-1',
        });
    });

    it.each([
        'not-a-url',
        'http://example.com',
        'https://user:password@example.com',
        'https://example.com?secret=x',
        'https://example.com#fragment',
    ])('rejects unsafe endpoint %s', (endpoint) => {
        expect(
            privo2ConfigurationSchema.safeParse({
                ...config,
                consentEndpoint: endpoint,
            }).success
        ).toBe(false);
    });
});
