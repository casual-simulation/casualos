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
import type { PrivoSignUpRequest } from './AuthController';
import { AuthController } from './AuthController';
import { MemoryStore } from './MemoryStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { privoSchema } from './PrivoConfiguration';
import { Privo2Client } from './Privo2Client';
import type { Privo2ConsentClient } from './Privo2ConsentClient';
import type { PrivoClientInterface } from './PrivoClient';
import type { GenericOpenIDClientInterface } from './GenericOpenIDClient';

jest.unmock('uuid');
jest.unmock('tweetnacl');

const config = privoSchema.parse({
    gatewayEndpoint: 'https://legacy.example.com',
    publicEndpoint: 'https://legacy.example.com',
    clientId: 'legacy-client',
    clientSecret: 'legacy-secret',
    redirectUri: 'https://app.example.com/oauth',
    roleIds: { child: 'child', adult: 'adult', parent: 'parent' },
    featureIds: {
        childPrivoSSO: 'child',
        adultPrivoSSO: 'adult',
        projectDevelopment: 'legacy-dev',
        publishProjects: 'legacy-publish',
        joinAndCollaborate: 'legacy-join',
        buildAIEggs: 'legacy-ai',
    },
    registrationProvider: 'privo2',
    privo2: {
        enabled: true,
        consentEndpoint: 'https://consent.example.com',
        authEndpoint: 'https://idp.example.com',
        tokenEndpoint: 'https://idp.example.com/token',
        clientId: 'new-client',
        clientSecret: 'new-secret',
        serviceIdentifier: 'service',
        redirectUri: 'https://app.example.com/oauth',
        credentialRedirectUri: 'https://app.example.com/login',
        featureIds: {
            account: 'account',
            projectDevelopment: 'dev',
            publishProjects: 'publish',
            joinAndCollaborate: 'join',
            buildAIEggs: 'ai',
        },
        webhookSecret: 'a'.repeat(32),
    },
});
const noFeatures = {
    publishData: false,
    allowPublicData: false,
    allowPublicInsts: false,
    allowAI: false,
};
const approvedAccount = {
    sub: 'same-sid',
    email: 'shared@example.com',
    features: ['account', 'dev', 'publish', 'join', 'ai'].map(
        (feature_identifier) => ({ feature_identifier, state: 'on' })
    ),
};
const signup: PrivoSignUpRequest = {
    parentEmail: null,
    name: 'Alex',
    displayName: 'Moonwalker',
    email: 'user@example.com',
    dateOfBirth: new Date('2000-01-01T00:00:00Z'),
    ipAddress: '127.0.0.1',
};

describe('PRIVO2 mixed-provider authentication', () => {
    let store: MemoryStore;
    let client: Privo2Client;
    let controller: AuthController;
    let transport: {
        createConsentRequest: jest.Mock;
        createCredentialSetup: jest.Mock;
        getAccount: jest.Mock;
        resendConsentRequest: jest.Mock;
    };
    let legacy: jest.Mocked<PrivoClientInterface>;
    let oidc: jest.Mocked<GenericOpenIDClientInterface>;

    beforeEach(() => {
        store = new MemoryStore({
            privo: structuredClone(config),
            subscriptions: null,
        });
        client = new Privo2Client(store);
        transport = {
            createConsentRequest: jest.fn().mockResolvedValue({
                consent_identifier: 'consent',
                principal_identifiers: { sid: 'same-sid' },
                granter_identifiers: { sid: 'granter' },
                state: 'pending',
                features: [],
            }),
            createCredentialSetup: jest.fn().mockResolvedValue({
                url: 'https://idp.example.com/setup',
                credentials_compliant: false,
            }),
            getAccount: jest
                .fn()
                .mockResolvedValue(structuredClone(approvedAccount)),
            resendConsentRequest: jest.fn().mockResolvedValue({}),
        };
        jest.spyOn(client, 'getClient').mockResolvedValue(
            transport as unknown as Privo2ConsentClient
        );
        legacy = {
            createAdultAccount: jest.fn(),
            createChildAccount: jest.fn(),
            getUserInfo: jest.fn(),
            generateAuthorizationUrl: jest.fn().mockResolvedValue({
                authorizationUrl: 'https://legacy.example.com/login',
                redirectUrl: 'https://app.example.com/oauth',
                codeVerifier: 'legacy-verifier',
                codeMethod: 'S256',
                scope: 'openid',
            }),
            processAuthorizationCallback: jest.fn(),
            checkEmail: jest.fn(),
            checkDisplayName: jest.fn(),
            generateLogoutUrl: jest.fn(),
            resendConsentRequest: jest.fn(),
            lookupServiceId: jest.fn(),
        };
        oidc = {
            generateAuthorizationUrl: jest.fn().mockResolvedValue({
                authorizationUrl: 'https://idp.example.com/login',
                redirectUrl: 'https://app.example.com/oauth',
                codeVerifier: 'new-verifier',
                codeMethod: 'S256',
                scope: 'openid',
                nonce: 'nonce',
            }),
            processAuthorizationCallback: jest.fn().mockResolvedValue({
                accessToken: 'access',
                refreshToken: 'refresh',
                idToken: 'id-token',
                expiresIn: 300,
                tokenType: 'Bearer',
                userInfo: { sub: 'same-sid', email: 'shared@example.com' },
            }),
        };
        controller = new AuthController(
            store,
            new MemoryAuthMessenger(),
            store,
            store,
            legacy,
            [],
            oidc,
            client
        );
    });

    async function seedUsers() {
        await store.saveUser({
            id: 'legacy-user',
            email: 'shared@example.com',
            phoneNumber: null,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            privoServiceId: 'same-sid',
        });
        await store.saveUser({
            id: 'new-user',
            email: null,
            phoneNumber: null,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            privo2ServiceId: 'same-sid',
            privo2GranterServiceId: 'granter',
            privo2ConsentId: 'consent',
            privacyFeatures: noFeatures,
        });
    }

    async function completeNewLogin(provider = 'privo2') {
        const request = await controller.requestOpenIDLogin({
            provider,
            ipAddress: '127.0.0.1',
        });
        if (!request.success) throw new Error('Request failed');
        const stored = store.openIdLoginRequests.find(
            (r) => r.requestId === request.requestId
        );
        await controller.processOpenIDAuthorizationCode({
            state: stored.state,
            authorizationCode: 'code',
            ipAddress: '127.0.0.1',
        });
        return controller.completeOpenIDLogin({
            requestId: request.requestId,
            ipAddress: '127.0.0.1',
        });
    }

    it('lists both providers and retains legacy login when PRIVO2 registration is selected', async () => {
        expect(await controller.listOpenIDProviders()).toEqual({
            success: true,
            providers: [
                { id: 'privo', name: 'Privo' },
                { id: 'privo2', name: 'PRIVO iD' },
            ],
        });
        await controller.requestOpenIDLogin({
            provider: 'privo',
            ipAddress: '127.0.0.1',
        });
        expect(legacy.generateAuthorizationUrl).toHaveBeenCalled();
        expect(oidc.generateAuthorizationUrl).not.toHaveBeenCalled();
    });

    it.each(['privo', 'privo2'] as const)(
        'selects %s login independently of signup and rejects the other provider',
        async (provider) => {
            store.privoConfiguration = {
                ...store.privoConfiguration,
                loginProvider: provider,
            };
            expect(await controller.listOpenIDProviders()).toEqual({
                success: true,
                providers: [
                    {
                        id: provider,
                        name: provider === 'privo' ? 'Privo' : 'PRIVO iD',
                    },
                ],
            });
            expect(
                await controller.requestOpenIDLogin({
                    provider: provider === 'privo' ? 'privo2' : 'privo',
                    ipAddress: '127.0.0.1',
                })
            ).toMatchObject({ success: false, errorCode: 'not_supported' });
            expect(
                await controller.requestOpenIDLogin({
                    provider,
                    ipAddress: '127.0.0.1',
                })
            ).toMatchObject({ success: true });
        }
    );

    it('keeps the PRIVO2 provider and nonce on login requests', async () => {
        await controller.requestOpenIDLogin({
            provider: 'privo2',
            ipAddress: '127.0.0.1',
        });
        expect(store.openIdLoginRequests[0]).toMatchObject({
            provider: 'privo2',
            nonce: 'nonce',
            codeVerifier: 'new-verifier',
        });
        expect(oidc.generateAuthorizationUrl).toHaveBeenCalledWith(
            expect.objectContaining({
                clientId: 'new-client',
                discoveryUri: 'https://idp.example.com',
            }),
            expect.any(String)
        );
    });

    it('matches only the PRIVO2 user even when legacy SID and email collide', async () => {
        await seedUsers();
        const result = await completeNewLogin();
        expect(result).toMatchObject({ success: true, userId: 'new-user' });
        expect(store.sessions[0]).toMatchObject({
            userId: 'new-user',
            oidProvider: 'privo2',
        });
        expect(legacy.processAuthorizationCallback).not.toHaveBeenCalled();
        expect(oidc.processAuthorizationCallback).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                nonce: 'nonce',
                codeVerifier: 'new-verifier',
            })
        );
    });

    it('does not link an unknown PRIVO2 identity to a matching legacy email', async () => {
        await store.saveUser({
            id: 'legacy-user',
            email: 'shared@example.com',
            phoneNumber: null,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            privoServiceId: 'same-sid',
        });
        expect(await completeNewLogin()).toMatchObject({
            success: false,
            errorCode: 'invalid_request',
        });
        expect(store.sessions).toHaveLength(0);
    });

    it('rejects login without account consent', async () => {
        await seedUsers();
        transport.getAccount.mockResolvedValue({
            sub: 'same-sid',
            features: [{ feature_identifier: 'account', state: 'pending' }],
        });
        expect(await completeNewLogin()).toMatchObject({
            success: false,
            errorCode: 'invalid_request',
        });
    });

    it('keeps PRIVO2 login working after rolling new registrations back to legacy', async () => {
        await seedUsers();
        store.privoConfiguration = {
            ...store.privoConfiguration,
            registrationProvider: 'privo',
        };
        expect(await completeNewLogin()).toMatchObject({
            success: true,
            userId: 'new-user',
        });
    });

    it('persists all consent IDs before creating credentials', async () => {
        transport.createCredentialSetup.mockImplementation(async () => {
            expect(
                await store.findUserByPrivo2ServiceId('same-sid')
            ).toMatchObject({
                privo2ConsentId: 'consent',
                privo2GranterServiceId: 'granter',
                privacyFeatures: noFeatures,
            });
            return {
                url: 'https://idp.example.com/setup',
                credentials_compliant: false,
            };
        });
        const result = await controller.requestPrivoSignUp(signup);
        expect(result).toMatchObject({
            success: true,
            updatePasswordUrl: 'https://idp.example.com/setup',
            privoProvider: 'privo2',
        });
        const payload = transport.createConsentRequest.mock.calls[0][0];
        expect(payload.principal.birthdate).toBe('20000101');
        expect(payload.principal.birthdate_precision).toBe('yyyymmdd');
        expect(payload.principal.eid).toBe(payload.granter.eid);
        expect(payload.principal.email).toBe(payload.granter.email);
        expect(payload.features).toEqual(
            expect.arrayContaining(['account', 'dev'])
        );
        expect(legacy.createAdultAccount).not.toHaveBeenCalled();
    });

    it('sends a minor consent request to the parent without sharing the principal EID', async () => {
        const birth = new Date();
        birth.setUTCFullYear(birth.getUTCFullYear() - 10);
        expect(
            await controller.requestPrivoSignUp({
                ...signup,
                dateOfBirth: birth,
                parentEmail: 'parent@example.com',
            })
        ).toMatchObject({ success: true });
        expect(transport.createConsentRequest.mock.calls[0][0].granter).toEqual(
            { email: 'parent@example.com' }
        );
    });

    it('returns a resumable setup state without recreating consent', async () => {
        transport.createCredentialSetup.mockRejectedValueOnce(
            new Error('unavailable')
        );
        const result = await controller.requestPrivoSignUp(signup);
        expect(result).toMatchObject({
            success: true,
            credentialSetupPending: true,
        });
        if (!result.success) throw new Error('Signup failed');
        expect(
            await controller.requestPrivo2CredentialSetup(result.sessionKey)
        ).toEqual({ success: true, url: 'https://idp.example.com/setup' });
        expect(transport.createConsentRequest).toHaveBeenCalledTimes(1);
    });

    it('rejects registration that resolves to an already-owned PRIVO2 SID', async () => {
        await seedUsers();
        expect(await controller.requestPrivoSignUp(signup)).toMatchObject({
            success: false,
            errorCode: 'unacceptable_request',
        });
        expect(transport.createCredentialSetup).not.toHaveBeenCalled();
        expect(store.sessions).toHaveLength(0);
    });

    it('rejects unauthenticated webhooks before fetching account data', async () => {
        expect(
            await controller.handlePrivo2Webhook('wrong', {
                id: 'event',
                sid: 'same-sid',
                event_types: ['consent_updated'],
            })
        ).toMatchObject({ success: false, errorCode: 'not_authorized' });
        expect(transport.getAccount).not.toHaveBeenCalled();
    });

    it('uses authoritative state for repeated or stale webhook events', async () => {
        await seedUsers();
        const body = {
            id: 'event',
            sid: 'same-sid',
            event_types: ['consent_updated'],
            features: [{ feature_identifier: 'account', state: 'revoked' }],
        };
        expect(
            await controller.handlePrivo2Webhook('a'.repeat(32), body)
        ).toEqual({ success: true });
        expect(
            await controller.handlePrivo2Webhook('a'.repeat(32), body)
        ).toEqual({ success: true });
        expect((await store.findUser('new-user')).privacyFeatures.allowAI).toBe(
            true
        );
        expect(
            (await store.findUser('legacy-user')).allSessionRevokeTimeMs
        ).toBeNull();
    });

    it('revokes only PRIVO2 sessions when consent is revoked', async () => {
        await seedUsers();
        transport.getAccount.mockResolvedValue({
            sub: 'same-sid',
            features: [{ feature_identifier: 'account', state: 'revoked' }],
        });
        await controller.handlePrivo2Webhook('a'.repeat(32), {
            id: 'event',
            sid: 'same-sid',
            event_types: ['account_feature_updated'],
        });
        expect((await store.findUser('new-user')).privacyFeatures).toEqual(
            noFeatures
        );
        expect(
            (await store.findUser('new-user')).allSessionRevokeTimeMs
        ).toEqual(expect.any(Number));
        expect(
            (await store.findUser('legacy-user')).allSessionRevokeTimeMs
        ).toBeNull();
    });

    it('uses the PRIVO2 logout endpoint after a registration rollback', async () => {
        await seedUsers();
        const login = await completeNewLogin();
        if (!login.success) throw new Error('Login failed');
        store.privoConfiguration = {
            ...store.privoConfiguration,
            registrationProvider: 'privo',
        };
        const session = store.sessions[0];
        const result = await controller.revokeSession({
            userId: 'new-user',
            sessionId: session.sessionId,
            sessionKey: login.sessionKey,
        });
        expect(result).toMatchObject({
            success: true,
            logoutUrl:
                'https://idp.example.com/openid-connect/logout?id_token_hint=id-token',
        });
        expect(legacy.generateLogoutUrl).not.toHaveBeenCalled();
    });
    it('keeps a pending registration session usable for credential setup', async () => {
        const signupResult = await controller.requestPrivoSignUp(signup);
        if (!signupResult.success) throw new Error('Signup failed');
        transport.getAccount.mockResolvedValue({
            sub: 'same-sid',
            features: [{ feature_identifier: 'account', state: 'pending' }],
        });
        await controller.handlePrivo2Webhook('a'.repeat(32), {
            id: 'pending-event',
            sid: 'same-sid',
            event_types: ['consent_request_created'],
        });
        expect(
            await controller.requestPrivo2CredentialSetup(
                signupResult.sessionKey
            )
        ).toMatchObject({ success: true });
    });

    it('does not attach legacy login to a PRIVO2 account by email', async () => {
        await store.saveUser({
            id: 'new-user',
            email: 'shared@example.com',
            phoneNumber: null,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            privo2ServiceId: 'new-sid',
        });
        legacy.processAuthorizationCallback.mockResolvedValue({
            accessToken: 'access',
            refreshToken: 'refresh',
            idToken: 'id-token',
            expiresIn: 300,
            tokenType: 'Bearer',
            userInfo: {
                serviceId: 'legacy-sid',
                email: 'shared@example.com',
                roleIdentifier: 'adult',
                permissions: [],
                emailVerified: true,
                displayName: 'name',
                givenName: 'name',
                locale: 'en',
            },
        });
        expect(await completeNewLogin('privo')).toMatchObject({
            success: false,
            errorCode: 'invalid_request',
        });
        expect(
            (await store.findUser('new-user')).privoServiceId
        ).toBeUndefined();
    });

    it('does not acknowledge a webhook when authoritative account retrieval fails', async () => {
        await seedUsers();
        transport.getAccount.mockRejectedValue(new Error('unavailable'));
        expect(
            await controller.handlePrivo2Webhook('a'.repeat(32), {
                id: 'event',
                sid: 'same-sid',
                event_types: ['consent_updated'],
            })
        ).toMatchObject({ success: false, errorCode: 'server_error' });
        expect((await store.findUser('new-user')).privacyFeatures).toEqual(
            noFeatures
        );
    });
});
