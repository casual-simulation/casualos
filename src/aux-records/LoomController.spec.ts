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
import type { MemoryStore } from './MemoryStore';
import type { LoomGetTokenSuccess } from './LoomController';
import { LoomController } from './LoomController';
import { createTestControllers } from './TestUtils';
import type { RecordsController } from './RecordsController';
import type { PolicyController } from './PolicyController';
import * as jose from 'jose';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';

console.log = jest.fn();

// Generated with:
// $ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 36500 -nodes
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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
iW7ByiIykfraimQSzn7Il6dpcvug0Io=
-----END PRIVATE KEY-----`;

describe('LoomController', () => {
    let controller: LoomController;
    let userId: string;
    let studioId: string;
    let store: MemoryStore;
    let records: RecordsController;
    let policies: PolicyController;

    beforeEach(async () => {
        userId = 'test-user';
        studioId = 'studioId';
        const services = createTestControllers();

        store = services.store;
        policies = services.policies;
        records = services.records;
        controller = new LoomController({
            metrics: store,
            config: store,
            store: store,
            policies: policies,
        });

        await store.saveUser({
            id: userId,
            email: 'test@example.com',
            phoneNumber: null,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
        });

        await store.createStudioForUser(
            {
                id: studioId,
                displayName: 'myStudio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            },
            userId
        );

        await store.updateStudioLoomConfig(studioId, {
            appId: 'appId',
            privateKey: PRIVATE_KEY,
        });

        store.subscriptionConfiguration = buildSubscriptionConfig((config) =>
            config.addSubscription('sub1', (sub) =>
                sub.withTier('tier1').withAllDefaultFeatures().withLoom()
            )
        );
    });

    describe('getToken()', () => {
        it('should return a token if the user is allowed to create a loom video', async () => {
            const result = (await controller.getToken({
                recordName: studioId,
                userId: userId,
            })) as LoomGetTokenSuccess;

            expect(result).toEqual({
                success: true,
                token: expect.any(String),
            });

            const header = jose.decodeProtectedHeader(result.token);
            expect(header.alg).toBe('RS256');

            const decoded = jose.decodeJwt(result.token);
            expect(decoded).toEqual({
                iss: 'appId',
                iat: expect.any(Number),
                exp: expect.any(Number),
            });
        });

        it('should return not_logged_in if the user is not logged in', async () => {
            const result = (await controller.getToken({
                recordName: studioId,
                userId: null,
            })) as LoomGetTokenSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey or a recordKey.',
            });
        });

        it('should return record_not_found if the record doesnt exist', async () => {
            const result = (await controller.getToken({
                recordName: 'missing',
                userId: userId,
            })) as LoomGetTokenSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'record_not_found',
                errorMessage: 'Record not found.',
            });
        });

        it('should return not_authorized if the user is not a member of the studio', async () => {
            const result = (await controller.getToken({
                recordName: studioId,
                userId: 'other-user',
            })) as LoomGetTokenSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: studioId,
                    resourceKind: 'loom',
                    action: 'create',
                    subjectId: 'other-user',
                    subjectType: 'user',
                },
            });
        });

        it('should return invalid_request if the studio has no configured loom settings', async () => {
            await store.updateStudioLoomConfig(studioId, null as any);
            const result = (await controller.getToken({
                recordName: studioId,
                userId: userId,
            })) as LoomGetTokenSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The studio does not have a loom configuration.',
            });
        });

        it('should return subscription_limit_reached if the studio doesnt have a valid subscription', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config
                        .addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withLoom()
                        )
                        .withStudioDefaultFeatures((features) =>
                            features.withAllDefaultFeatures()
                        )
            );
            await store.updateStudio({
                id: studioId,
                displayName: 'myStudio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'inactive',
            });

            const result = (await controller.getToken({
                recordName: studioId,
                userId: userId,
            })) as LoomGetTokenSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'Loom features are not enabled for this subscription.',
            });
        });
    });
});
