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
import type { AddressInfo } from 'net';
import type { IncomingHttpHeaders, Server } from 'http';
import { createServer } from 'http';
import { createSign, generateKeyPairSync } from 'crypto';
import { GenericOpenIDClient } from './GenericOpenIDClient';
import type { OpenIDProviderConfiguration } from './OpenIDConfiguration';

describe('GenericOpenIDClient', () => {
    let server: Server;
    let baseUrl: string;
    let tokenRequests: {
        headers: IncomingHttpHeaders;
        body: URLSearchParams;
    }[];
    let client: GenericOpenIDClient;

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'key' };

    function base64url(value: string | Buffer) {
        return Buffer.from(value).toString('base64url');
    }

    function createIdToken(audience: string) {
        const now = Math.floor(Date.now() / 1000);
        const header = base64url(
            JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key' })
        );
        const payload = base64url(
            JSON.stringify({
                iss: baseUrl,
                aud: audience,
                sub: 'subject',
                nonce: 'nonce',
                iat: now,
                exp: now + 3600,
            })
        );
        const signature = createSign('RSA-SHA256')
            .update(`${header}.${payload}`)
            .sign(privateKey);
        return `${header}.${payload}.${base64url(signature)}`;
    }

    beforeEach(async () => {
        tokenRequests = [];
        server = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
                res.setHeader('Content-Type', 'application/json');
                if (req.url === '/token') {
                    tokenRequests.push({
                        headers: req.headers,
                        body: new URLSearchParams(body),
                    });
                    res.end(
                        JSON.stringify({
                            access_token: 'accessToken',
                            refresh_token: 'refreshToken',
                            id_token: createIdToken('my client'),
                            token_type: 'Bearer',
                            expires_in: 3600,
                        })
                    );
                } else if (req.url === '/jwks') {
                    res.end(JSON.stringify({ keys: [jwk] }));
                } else if (req.url === '/userinfo') {
                    res.end(
                        JSON.stringify({
                            sub: 'subject',
                            email: 'test@example.com',
                            name: 'Test',
                        })
                    );
                } else {
                    res.statusCode = 404;
                    res.end('{}');
                }
            });
        });
        await new Promise<void>((resolve) =>
            server.listen(0, '127.0.0.1', resolve)
        );
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        client = new GenericOpenIDClient();
    });

    afterEach(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    function config(
        overrides: Partial<OpenIDProviderConfiguration> = {},
        issuerOverrides: Record<string, unknown> = {}
    ): OpenIDProviderConfiguration {
        return {
            id: 'test',
            name: 'Test',
            issuer: {
                issuer: baseUrl,
                authorization_endpoint: `${baseUrl}/authorize`,
                token_endpoint: `${baseUrl}/token`,
                userinfo_endpoint: `${baseUrl}/userinfo`,
                jwks_uri: `${baseUrl}/jwks`,
                ...issuerOverrides,
            },
            redirectUri: 'https://example.com/callback',
            clientId: 'my client',
            clientSecret: 'my+secret/=',
            requestScopes: ['openid'],
            ...overrides,
        };
    }

    async function exchange(c: OpenIDProviderConfiguration) {
        return await client.processAuthorizationCallback(c, {
            code: 'code',
            state: 'state',
            codeVerifier: 'verifier',
            nonce: 'nonce',
            redirectUrl: 'https://example.com/callback',
        });
    }

    describe('processAuthorizationCallback()', () => {
        it('should use client_secret_basic by default', async () => {
            const result = await exchange(config());

            expect(result.accessToken).toBe('accessToken');
            expect(result.userInfo).toEqual({
                sub: 'subject',
                email: 'test@example.com',
                name: 'Test',
            });
            expect(tokenRequests).toHaveLength(1);
            const [request] = tokenRequests;
            expect(request.headers.authorization).toBe(
                `Basic ${Buffer.from(
                    `${encodeURIComponent('my client').replace(
                        /%20/g,
                        '+'
                    )}:${encodeURIComponent('my+secret/=')}`
                ).toString('base64')}`
            );
            expect(request.body.get('client_secret')).toBeNull();
            expect(request.body.get('code_verifier')).toBe('verifier');
        });

        it('should send the client secret in the body when using client_secret_post', async () => {
            await exchange(
                config({ tokenEndpointAuthMethod: 'client_secret_post' })
            );

            expect(tokenRequests).toHaveLength(1);
            const [request] = tokenRequests;
            expect(request.headers.authorization).toBeUndefined();
            expect(request.body.get('client_id')).toBe('my client');
            expect(request.body.get('client_secret')).toBe('my+secret/=');
            expect(request.body.get('code_verifier')).toBe('verifier');
        });

        it('should only send the client ID when using none', async () => {
            await exchange(
                config({
                    tokenEndpointAuthMethod: 'none',
                    clientSecret: undefined,
                })
            );

            expect(tokenRequests).toHaveLength(1);
            const [request] = tokenRequests;
            expect(request.headers.authorization).toBeUndefined();
            expect(request.body.get('client_id')).toBe('my client');
            expect(request.body.get('client_secret')).toBeNull();
            expect(request.body.get('code_verifier')).toBe('verifier');
        });

        it('should not send the client secret when using none even if one is configured', async () => {
            await exchange(config({ tokenEndpointAuthMethod: 'none' }));

            const [request] = tokenRequests;
            expect(request.headers.authorization).toBeUndefined();
            expect(request.body.get('client_secret')).toBeNull();
        });

        it('should use client_secret_post when the issuer metadata only supports it', async () => {
            await exchange(
                config(
                    {},
                    {
                        token_endpoint_auth_methods_supported: [
                            'client_secret_post',
                        ],
                    }
                )
            );

            const [request] = tokenRequests;
            expect(request.headers.authorization).toBeUndefined();
            expect(request.body.get('client_secret')).toBe('my+secret/=');
        });
    });
});
