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
import type { RegexRule } from '@casual-simulation/aux-records';
import type {
    AddressType,
    AuthInvoice,
    AuthLoginRequest,
    AuthOpenIDLoginRequest,
    AuthSession,
    AuthStore,
    AuthSubscription,
    AuthSubscriptionPeriod,
    AuthUser,
    AuthUserAuthenticator,
    AuthUserAuthenticatorWithUser,
    AuthWebAuthnLoginRequest,
    ListSessionsDataResult,
    SaveNewUserResult,
    UpdateSubscriptionInfoRequest,
    UpdateSubscriptionPeriodRequest,
    UserLoginMetadata,
} from '@casual-simulation/aux-records/AuthStore';
import type {
    PrismaClient,
    User,
    UserAuthenticator,
    AuthSession as PrismaSession,
    Subscription as PrismaSubscription,
    SubscriptionPeriod,
} from './generated';
import { Prisma } from './generated';
// import { PrismaClientKnownRequestError } from './generated/runtime';
import { convertToDate, convertToMillis } from './Utils';
import { v4 as uuid } from 'uuid';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { UserRole } from '@casual-simulation/aux-common';

const TRACE_NAME = 'PrismaAuthStore';

export class PrismaAuthStore implements AuthStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async listEmailRules(): Promise<RegexRule[]> {
        const rules = await this._client.emailRule.findMany();
        return rules.map((r) => ({
            type: r.type as RegexRule['type'],
            pattern: r.pattern,
        }));
    }

    @traced(TRACE_NAME)
    async listSmsRules(): Promise<RegexRule[]> {
        const rules = await this._client.smsRule.findMany();
        return rules.map((r) => ({
            type: r.type as RegexRule['type'],
            pattern: r.pattern,
        }));
    }

    @traced(TRACE_NAME)
    async findUser(userId: string): Promise<AuthUser | null> {
        if (!userId) {
            return null;
        }
        const user = await this._client.user.findUnique({
            where: {
                id: userId,
            },
        });

        return this._convertToAuthUser(user);
    }

    @traced(TRACE_NAME)
    async findUserByStripeCustomerId(
        customerId: string
    ): Promise<AuthUser | null> {
        if (!customerId) {
            return null;
        }
        const user = await this._client.user.findUnique({
            where: {
                stripeCustomerId: customerId,
            },
        });

        return this._convertToAuthUser(user);
    }

    @traced(TRACE_NAME)
    async findUserByPrivoServiceId(serviceId: string): Promise<AuthUser> {
        if (!serviceId) {
            return null;
        }
        const user = await this._client.user.findUnique({
            where: {
                privoServiceId: serviceId,
            },
        });

        return this._convertToAuthUser(user);
    }

    @traced(TRACE_NAME)
    async setRevokeAllSessionsTimeForUser(
        userId: string,
        allSessionRevokeTimeMs: number
    ): Promise<void> {
        await this._client.user.update({
            where: {
                id: userId,
            },
            data: {
                allSessionRevokeTime: convertToDate(allSessionRevokeTimeMs),
            },
        });
    }

    @traced(TRACE_NAME)
    async setCurrentLoginRequest(
        userId: string,
        requestId: string
    ): Promise<void> {
        await this._client.user.update({
            where: {
                id: userId,
            },
            data: {
                currentLoginRequestId: requestId,
            },
        });
    }

    @traced(TRACE_NAME)
    async findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser | null> {
        if (!address) {
            return null;
        }
        let user = await this._client.user.findUnique({
            where:
                addressType === 'email'
                    ? {
                          email: address,
                      }
                    : {
                          phoneNumber: address,
                      },
        });

        // If no exact match was found for email, then try to find a case-insensitive match.
        if (!user && addressType === 'email') {
            user = await this._client.user.findFirst({
                where: {
                    email: {
                        equals: address,
                        mode: 'insensitive',
                    },
                },
            });
        }

        return this._convertToAuthUser(user);
    }

    @traced(TRACE_NAME)
    async saveUser(user: AuthUser): Promise<void> {
        const userData: Prisma.UserUncheckedCreateInput = {
            id: user.id,
            name: user.name as string,
            email: user.email,
            phoneNumber: user.phoneNumber,
            avatarUrl: user.avatarUrl as string,
            avatarPortraitUrl: user.avatarPortraitUrl as string,
            allSessionRevokeTime: convertToDate(user.allSessionRevokeTimeMs),
            currentLoginRequestId: user.currentLoginRequestId as string,
            stripeCustomerId: user.stripeCustomerId as string,
            subscriptionStatus: user.subscriptionStatus as string,
            subscriptionId: user.subscriptionId as string,
            subscriptionPeriodStart: convertToDate(
                user.subscriptionPeriodStartMs
            ),
            subscriptionPeriodEnd: convertToDate(user.subscriptionPeriodEndMs),
            banTime: convertToDate(user.banTimeMs),
            banReason: user.banReason as string,
            privoServiceId: user.privoServiceId as string,
            privoParentServiceId: user.privoParentServiceId as string,
            privoConsentUrl: user.privoConsentUrl,
            allowPublishData: user.privacyFeatures?.publishData ?? true,
            allowPublicData: user.privacyFeatures?.allowPublicData ?? true,
            allowAI: user.privacyFeatures?.allowAI ?? true,
            allowPublicInsts: user.privacyFeatures?.allowPublicInsts ?? true,
            role: user.role,
        };

        await this._client.user.upsert({
            where: {
                id: user.id,
            },
            create: userData,
            update: userData,
        });
    }

    @traced(TRACE_NAME)
    async saveNewUser(user: AuthUser): Promise<SaveNewUserResult> {
        try {
            let createData: Prisma.UserCreateInput = {
                id: user.id,
                name: user.name as string,
                email: user.email,
                phoneNumber: user.phoneNumber,
                avatarUrl: user.avatarUrl as string,
                avatarPortraitUrl: user.avatarPortraitUrl as string,
                allSessionRevokeTime: convertToDate(
                    user.allSessionRevokeTimeMs
                ),
                stripeCustomerId: user.stripeCustomerId as string,
                subscriptionStatus: user.subscriptionStatus as string,
                subscriptionId: user.subscriptionId as string,
                subscriptionPeriodStart: convertToDate(
                    user.subscriptionPeriodStartMs
                ),
                subscriptionPeriodEnd: convertToDate(
                    user.subscriptionPeriodEndMs
                ),
                banTime: convertToDate(user.banTimeMs),
                banReason: user.banReason as string,
                privoServiceId: user.privoServiceId as string,
                privoParentServiceId: user.privoParentServiceId as string,
                privoConsentUrl: user.privoConsentUrl,
                allowPublishData: user.privacyFeatures?.publishData ?? true,
                allowPublicData: user.privacyFeatures?.allowPublicData ?? true,
                allowAI: user.privacyFeatures?.allowAI ?? true,
                allowPublicInsts:
                    user.privacyFeatures?.allowPublicInsts ?? true,
                role: user.role,
            };

            if (!!user.currentLoginRequestId) {
                createData.currentLoginRequest = {
                    connect: {
                        requestId: user.currentLoginRequestId as string,
                    },
                };
            }

            await this._client.user.create({
                data: createData,
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2002') {
                    return {
                        success: false,
                        errorCode: 'user_already_exists',
                        errorMessage: 'The user already exists.',
                    };
                }
            }
            throw err;
        }

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest | null> {
        if (!requestId) {
            return null;
        }
        const request = await this._client.loginRequest.findUnique({
            where: {
                requestId: requestId,
            },
        });

        if (!request) {
            return null;
        }

        return {
            requestId: request.requestId,
            address: request.address,
            addressType: request.addressType as AddressType,
            userId: request.userId,
            attemptCount: request.attemptCount,
            completedTimeMs: convertToMillis(request.completedTime),
            expireTimeMs: convertToMillis(request.expireTime) as number,
            requestTimeMs: convertToMillis(request.requestTime) as number,
            ipAddress: request.ipAddress,
            secretHash: request.secretHash,
        };
    }

    @traced(TRACE_NAME)
    async findOpenIDLoginRequest(
        requestId: string
    ): Promise<AuthOpenIDLoginRequest> {
        if (!requestId) {
            return null;
        }
        const request = await this._client.openIDLoginRequest.findUnique({
            where: {
                requestId: requestId,
            },
        });

        if (!request) {
            return null;
        }

        return {
            requestId: request.requestId,
            state: request.state,
            authorizationUrl: request.authorizationUrl,
            redirectUrl: request.redirectUrl,
            codeMethod: request.codeMethod,
            codeVerifier: request.codeVerifier,
            provider: request.provider,
            scope: request.scope,
            requestTimeMs: convertToMillis(request.requestTime) as number,
            expireTimeMs: convertToMillis(request.expireTime) as number,
            completedTimeMs: convertToMillis(request.completedTime),
            authorizationTimeMs: convertToMillis(request.authorizationTime),
            authorizationCode: request.authorizationCode,
            ipAddress: request.ipAddress,
        };
    }

    @traced(TRACE_NAME)
    async findOpenIDLoginRequestByState(
        state: string
    ): Promise<AuthOpenIDLoginRequest> {
        if (!state) {
            return null;
        }
        const request = await this._client.openIDLoginRequest.findUnique({
            where: {
                state: state,
            },
        });

        if (!request) {
            return null;
        }

        return {
            requestId: request.requestId,
            state: request.state,
            authorizationUrl: request.authorizationUrl,
            redirectUrl: request.redirectUrl,
            codeMethod: request.codeMethod,
            codeVerifier: request.codeVerifier,
            provider: request.provider,
            scope: request.scope,
            requestTimeMs: convertToMillis(request.requestTime) as number,
            expireTimeMs: convertToMillis(request.expireTime) as number,
            completedTimeMs: convertToMillis(request.completedTime),
            authorizationTimeMs: convertToMillis(request.authorizationTime),
            authorizationCode: request.authorizationCode,
            ipAddress: request.ipAddress,
        };
    }

    @traced(TRACE_NAME)
    async saveOpenIDLoginRequest(
        request: AuthOpenIDLoginRequest
    ): Promise<AuthOpenIDLoginRequest> {
        await this._client.openIDLoginRequest.upsert({
            where: {
                requestId: request.requestId,
            },
            create: {
                requestId: request.requestId,
                state: request.state,
                authorizationUrl: request.authorizationUrl,
                redirectUrl: request.redirectUrl,
                codeMethod: request.codeMethod,
                codeVerifier: request.codeVerifier,
                provider: request.provider,
                scope: request.scope,
                requestTime: convertToDate(request.requestTimeMs),
                expireTime: convertToDate(request.expireTimeMs),
                completedTime: convertToDate(request.completedTimeMs),
                authorizationTime: convertToDate(request.authorizationTimeMs),
                authorizationCode: request.authorizationCode,
                ipAddress: request.ipAddress,
            },
            update: {
                authorizationUrl: request.authorizationUrl,
                state: request.state,
                redirectUrl: request.redirectUrl,
                codeMethod: request.codeMethod,
                codeVerifier: request.codeVerifier,
                provider: request.provider,
                scope: request.scope,
                requestTime: convertToDate(request.requestTimeMs),
                expireTime: convertToDate(request.expireTimeMs),
                completedTime: convertToDate(request.completedTimeMs),
                authorizationTime: convertToDate(request.authorizationTimeMs),
                authorizationCode: request.authorizationCode,
                ipAddress: request.ipAddress,
            },
        });

        return request;
    }

    @traced(TRACE_NAME)
    async markOpenIDLoginRequestComplete(
        requestId: string,
        completedTimeMs: number
    ): Promise<void> {
        await this._client.openIDLoginRequest.update({
            where: {
                requestId: requestId,
            },
            data: {
                completedTime: convertToDate(completedTimeMs),
            },
        });
    }

    @traced(TRACE_NAME)
    async saveOpenIDLoginRequestAuthorizationCode(
        requestId: string,
        authorizationCode: string,
        authorizationTimeMs: number
    ): Promise<void> {
        await this._client.openIDLoginRequest.update({
            where: {
                requestId: requestId,
            },
            data: {
                authorizationCode: authorizationCode,
                authorizationTime: convertToDate(authorizationTimeMs),
            },
        });
    }

    @traced(TRACE_NAME)
    async findWebAuthnLoginRequest(
        requestId: string
    ): Promise<AuthWebAuthnLoginRequest> {
        const request = await this._client.webAuthnLoginRequest.findUnique({
            where: {
                requestId,
            },
        });

        if (!request) {
            return null;
        }

        return {
            requestId: request.requestId,
            userId: request.userId,
            challenge: request.challenge,
            requestTimeMs: convertToMillis(request.requestTime) as number,
            expireTimeMs: convertToMillis(request.expireTime) as number,
            completedTimeMs: convertToMillis(request.completedTime),
            ipAddress: request.ipAddress,
        };
    }

    @traced(TRACE_NAME)
    async saveWebAuthnLoginRequest(
        request: AuthWebAuthnLoginRequest
    ): Promise<AuthWebAuthnLoginRequest> {
        await this._client.webAuthnLoginRequest.upsert({
            where: {
                requestId: request.requestId,
            },
            create: {
                requestId: request.requestId,
                userId: request.userId,
                challenge: request.challenge,
                requestTime: convertToDate(request.requestTimeMs),
                expireTime: convertToDate(request.expireTimeMs),
                completedTime: convertToDate(request.completedTimeMs),
                ipAddress: request.ipAddress,
            },
            update: {
                challenge: request.challenge,
                requestTime: convertToDate(request.requestTimeMs),
                expireTime: convertToDate(request.expireTimeMs),
                completedTime: convertToDate(request.completedTimeMs),
                ipAddress: request.ipAddress,
            },
        });

        return request;
    }

    @traced(TRACE_NAME)
    async markWebAuthnLoginRequestComplete(
        requestId: string,
        userId: string,
        completedTimeMs: number
    ): Promise<void> {
        await this._client.webAuthnLoginRequest.update({
            where: {
                requestId: requestId,
            },
            data: {
                completedTime: convertToDate(completedTimeMs),
                userId: userId,
            },
        });
    }

    @traced(TRACE_NAME)
    async setCurrentWebAuthnChallenge(
        userId: string,
        challenge: string
    ): Promise<void> {
        await this._client.user.update({
            where: {
                id: userId,
            },
            data: {
                currentWebAuthnChallenge: challenge,
            },
        });
    }

    @traced(TRACE_NAME)
    async listUserAuthenticators(
        userId: string
    ): Promise<AuthUserAuthenticator[]> {
        const auths = await this._client.userAuthenticator.findMany({
            where: {
                userId: userId,
            },
        });

        return auths.map((a) => this._convertToUserAuthenticator(a));
    }

    @traced(TRACE_NAME)
    async saveUserAuthenticatorCounter(
        id: string,
        newCounter: number
    ): Promise<void> {
        await this._client.userAuthenticator.update({
            where: {
                id: id,
            },
            data: {
                counter: newCounter,
            },
        });
    }

    @traced(TRACE_NAME)
    async deleteUserAuthenticator(
        userId: string,
        authenticatorId: string
    ): Promise<number> {
        const result = await this._client.userAuthenticator.delete({
            where: {
                id: authenticatorId,
                userId,
            },
        });

        if (result) {
            return 1;
        }
        return 0;
    }

    private _convertToUserAuthenticator(
        authenticator: UserAuthenticator
    ): AuthUserAuthenticator {
        return {
            id: authenticator.id,
            credentialId: authenticator.credentialId,
            userId: authenticator.userId,
            counter: authenticator.counter,
            credentialBackedUp: authenticator.credentialBackedUp,
            credentialDeviceType:
                authenticator.credentialDeviceType as AuthUserAuthenticator['credentialDeviceType'],
            credentialPublicKey: new Uint8Array(
                authenticator.credentialPublicKey
            ),
            transports:
                authenticator.transports as AuthUserAuthenticator['transports'],
            aaguid: authenticator.aaguid,
            registeringUserAgent: authenticator.registeringUserAgent,
            createdAtMs: convertToMillis(authenticator.createdAt),
        };
    }

    @traced(TRACE_NAME)
    async findUserAuthenticatorByCredentialId(
        credentialId: string
    ): Promise<AuthUserAuthenticatorWithUser> {
        const authenticator = await this._client.userAuthenticator.findUnique({
            where: {
                credentialId: credentialId,
            },
            include: {
                user: true,
            },
        });

        if (!authenticator) {
            return { authenticator: null, user: null };
        }

        return {
            authenticator: this._convertToUserAuthenticator(authenticator),
            user: this._convertToAuthUser(authenticator.user),
        };
    }

    @traced(TRACE_NAME)
    async saveUserAuthenticator(
        authenticator: AuthUserAuthenticator
    ): Promise<void> {
        await this._client.userAuthenticator.upsert({
            where: {
                id: authenticator.id,
            },
            create: {
                id: authenticator.id,
                userId: authenticator.userId,
                credentialId: authenticator.credentialId,
                counter: authenticator.counter,
                credentialBackedUp: authenticator.credentialBackedUp,
                credentialDeviceType: authenticator.credentialDeviceType,
                credentialPublicKey: Buffer.from(
                    authenticator.credentialPublicKey
                ),
                transports: authenticator.transports,
                aaguid: authenticator.aaguid,
                registeringUserAgent: authenticator.registeringUserAgent,
                createdAt: convertToDate(authenticator.createdAtMs),
            },
            update: {
                id: authenticator.id,
                userId: authenticator.userId,
                credentialId: authenticator.credentialId,
                counter: authenticator.counter,
                credentialBackedUp: authenticator.credentialBackedUp,
                credentialDeviceType: authenticator.credentialDeviceType,
                credentialPublicKey: Buffer.from(
                    authenticator.credentialPublicKey
                ),
                transports: authenticator.transports,
                aaguid: authenticator.aaguid,
                registeringUserAgent: authenticator.registeringUserAgent,
            },
        });
    }

    @traced(TRACE_NAME)
    async findSession(
        userId: string,
        sessionId: string
    ): Promise<AuthSession | null> {
        if (!sessionId) {
            return null;
        }
        const session = await this._client.authSession.findUnique({
            where: {
                sessionId: sessionId,
            },
        });

        if (!session) {
            return null;
        }

        return this._convertToSession(session);
    }

    @traced(TRACE_NAME)
    async saveLoginRequest(
        request: AuthLoginRequest
    ): Promise<AuthLoginRequest> {
        const loginRequest = {
            requestId: request.requestId,
            userId: request.userId,
            secretHash: request.secretHash,
            address: request.address,
            addressType: request.addressType,
            attemptCount: request.attemptCount,
            expireTime: convertToDate(request.expireTimeMs) as Date,
            requestTime: convertToDate(request.requestTimeMs) as Date,
            completedTime: convertToDate(request.completedTimeMs),
            ipAddress: request.ipAddress,
        };
        await this._client.loginRequest.upsert({
            where: {
                requestId: request.requestId,
            },
            create: loginRequest,
            update: loginRequest,
        });
        return request;
    }

    @traced(TRACE_NAME)
    async markLoginRequestComplete(
        userId: string,
        requestId: string,
        completedTimeMs: number
    ): Promise<void> {
        await this._client.loginRequest.update({
            where: {
                requestId: requestId,
            },
            data: {
                completedTime: convertToDate(completedTimeMs),
            },
        });
    }

    @traced(TRACE_NAME)
    async incrementLoginRequestAttemptCount(
        userId: string,
        requestId: string
    ): Promise<void> {
        await this._client.loginRequest.update({
            where: {
                requestId: requestId,
            },
            data: {
                attemptCount: {
                    increment: 1,
                },
            },
        });
    }

    @traced(TRACE_NAME)
    async saveSession(session: AuthSession): Promise<void> {
        const sessionData = {
            sessionId: session.sessionId,
            userId: session.userId,
            secretHash: session.secretHash,
            grantedTime: convertToDate(session.grantedTimeMs) as Date,
            expireTime: convertToDate(session.expireTimeMs) as Date,
            revokeTime: convertToDate(session.revokeTimeMs),
            requestId: session.requestId,
            previousSessionId: session.previousSessionId,
            nextSessionId: session.nextSessionId,
            ipAddress: session.ipAddress,
            connectionSecret: session.connectionSecret,
            revocable: session.revocable,

            oidProvider: session.oidProvider,
            oidAccessToken: session.oidAccessToken,
            oidIdToken: session.oidIdToken,
            oidRefreshToken: session.oidRefreshToken,
            oidExpiresAtMs: session.oidExpiresAtMs,
            oidRequestId: session.oidRequestId,
            oidScope: session.oidScope,
            oidTokenType: session.oidTokenType,
        };
        await this._client.authSession.upsert({
            where: {
                sessionId: session.sessionId,
            },
            create: sessionData,
            update: sessionData,
        });
    }

    @traced(TRACE_NAME)
    async replaceSession(
        session: AuthSession,
        newSession: AuthSession,
        revokeTimeMs: number
    ): Promise<void> {
        await this._client.authSession.update({
            where: {
                sessionId: session.sessionId,
            },
            data: {
                revokeTime: convertToDate(revokeTimeMs),
                nextSession: {
                    create: {
                        sessionId: newSession.sessionId,
                        userId: newSession.userId,
                        secretHash: newSession.secretHash,
                        grantedTime: convertToDate(
                            newSession.grantedTimeMs
                        ) as Date,
                        expireTime: convertToDate(
                            newSession.expireTimeMs
                        ) as Date,
                        revokeTime: convertToDate(newSession.revokeTimeMs),
                        requestId: newSession.requestId,
                        ipAddress: newSession.ipAddress,
                        previousSessionId: session.sessionId,
                        connectionSecret: newSession.connectionSecret,
                        revocable: session.revocable,
                    },
                },
            },
        });
    }

    @traced(TRACE_NAME)
    async listSessions(
        userId: string,
        expireTimeMs: number
    ): Promise<ListSessionsDataResult> {
        if (!userId) {
            return null;
        }
        let where: Prisma.AuthSessionWhereInput = {
            userId: userId,
        };
        if (expireTimeMs) {
            where['expireTime'] = { lt: new Date(expireTimeMs) };
        }

        const sessions = await this._client.authSession.findMany({
            where,
            orderBy: {
                expireTime: 'desc',
            },
            take: 10,
        });

        return {
            success: true,
            sessions: sessions.map((s) => this._convertToSession(s)),
        };
    }

    @traced(TRACE_NAME)
    async saveSubscription(subscription: AuthSubscription): Promise<void> {
        const value = {
            ...subscription,
            currentPeriodEnd: convertToDate(subscription.currentPeriodEndMs),
            currentPeriodStart: convertToDate(
                subscription.currentPeriodStartMs
            ),
        };
        await this._client.subscription.upsert({
            where: {
                id: subscription.id,
            },
            create: value,
            update: value,
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionById(id: string): Promise<AuthSubscription> {
        if (!id) {
            return null;
        }
        const sub = await this._client.subscription.findUnique({
            where: {
                id: id,
            },
        });
        return this._convertToSubscription(sub);
    }

    @traced(TRACE_NAME)
    async getSubscriptionByStripeSubscriptionId(
        id: string
    ): Promise<AuthSubscription> {
        if (!id) {
            return null;
        }
        const sub = await this._client.subscription.findUnique({
            where: {
                stripeSubscriptionId: id,
            },
        });

        return this._convertToSubscription(sub);
    }

    @traced(TRACE_NAME)
    async saveSubscriptionPeriod(
        period: AuthSubscriptionPeriod
    ): Promise<void> {
        const value = {
            ...period,
            periodEnd: convertToDate(period.periodEndMs),
            periodStart: convertToDate(period.periodStartMs),
        };

        await this._client.subscriptionPeriod.upsert({
            where: {
                id: period.id,
            },
            create: value,
            update: value,
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionPeriodById(
        id: string
    ): Promise<AuthSubscriptionPeriod> {
        if (!id) {
            return null;
        }
        const period = await this._client.subscriptionPeriod.findUnique({
            where: {
                id: id,
            },
        });

        return this._convertToSubscriptionPeriod(period);
    }

    @traced(TRACE_NAME)
    async listSubscriptionPeriodsBySubscriptionId(
        subscriptionId: string
    ): Promise<AuthSubscriptionPeriod[]> {
        if (!subscriptionId) {
            return [];
        }
        const periods = await this._client.subscriptionPeriod.findMany({
            where: {
                subscriptionId,
            },
        });

        return periods.map((p) => this._convertToSubscriptionPeriod(p));
    }

    @traced(TRACE_NAME)
    async saveInvoice(invoice: AuthInvoice): Promise<void> {
        const value = {
            ...invoice,
        };

        await this._client.invoice.upsert({
            where: {
                id: invoice.id,
            },
            create: value,
            update: value,
        });
    }

    @traced(TRACE_NAME)
    async getInvoiceById(id: string): Promise<AuthInvoice> {
        if (!id) {
            return null;
        }
        return await this._client.invoice.findUnique({
            where: {
                id,
            },
        });
    }

    @traced(TRACE_NAME)
    async updateSubscriptionInfo(
        request: UpdateSubscriptionInfoRequest
    ): Promise<void> {
        const periodStart = convertToDate(request.currentPeriodStartMs);
        const periodEnd = convertToDate(request.currentPeriodEndMs);
        if (request.userId) {
            const updateData: Prisma.UserUpdateArgs<any>['data'] = {
                subscriptionId: request.subscriptionId,
                subscriptionStatus: request.subscriptionStatus,
                subscriptionPeriodStart: periodStart,
                subscriptionPeriodEnd: periodEnd,
            };

            if (request.stripeCustomerId) {
                updateData.stripeCustomerId = request.stripeCustomerId;
            }

            if (request.stripeSubscriptionId) {
                updateData.subscriptionInfo = {
                    upsert: {
                        create: {
                            id: uuid(),
                            userId: request.userId,
                            subscriptionId: request.subscriptionId,
                            subscriptionStatus: request.subscriptionStatus,
                            stripeCustomerId: request.stripeCustomerId,
                            stripeSubscriptionId: request.stripeSubscriptionId,
                            currentPeriodStart: periodStart,
                            currentPeriodEnd: periodEnd,
                        },
                        update: {
                            subscriptionId: request.subscriptionId,
                            subscriptionStatus: request.subscriptionStatus,
                            stripeCustomerId: request.stripeCustomerId,
                            stripeSubscriptionId: request.stripeSubscriptionId,
                            currentPeriodStart: periodStart,
                            currentPeriodEnd: periodEnd,
                        },
                    },
                };
            } else {
                updateData.subscriptionInfoId = null;
            }

            await this._client.user.update({
                where: {
                    id: request.userId,
                },
                data: updateData,
            });
        } else if (request.studioId) {
            const updateData: Prisma.StudioUpdateArgs<any>['data'] = {
                subscriptionId: request.subscriptionId,
                subscriptionStatus: request.subscriptionStatus,
                subscriptionPeriodStart: periodStart,
                subscriptionPeriodEnd: periodEnd,
            };

            if (request.stripeCustomerId) {
                updateData.stripeCustomerId = request.stripeCustomerId;
            }

            if (request.stripeSubscriptionId) {
                updateData.subscriptionInfo = {
                    upsert: {
                        create: {
                            id: uuid(),
                            studioId: request.studioId,
                            subscriptionId: request.subscriptionId,
                            subscriptionStatus: request.subscriptionStatus,
                            stripeCustomerId: request.stripeCustomerId,
                            stripeSubscriptionId: request.stripeSubscriptionId,
                            currentPeriodStart: periodStart,
                            currentPeriodEnd: periodEnd,
                        },
                        update: {
                            subscriptionId: request.subscriptionId,
                            subscriptionStatus: request.subscriptionStatus,
                            stripeCustomerId: request.stripeCustomerId,
                            stripeSubscriptionId: request.stripeSubscriptionId,
                            currentPeriodStart: periodStart,
                            currentPeriodEnd: periodEnd,
                        },
                    },
                };
            } else {
                updateData.subscriptionInfoId = null;
            }

            await this._client.studio.update({
                where: {
                    id: request.studioId,
                },
                data: updateData,
            });
        }
    }

    @traced(TRACE_NAME)
    async updateSubscriptionPeriod(
        request: UpdateSubscriptionPeriodRequest
    ): Promise<void> {
        const periodId: string = uuid();
        const invoiceId: string = uuid();
        const periodStart = convertToDate(request.currentPeriodStartMs);
        const periodEnd = convertToDate(request.currentPeriodEndMs);

        if (request.userId) {
            await this._client.user.update({
                where: {
                    id: request.userId,
                },
                data: {
                    subscriptionPeriodStart: periodStart,
                    subscriptionPeriodEnd: periodEnd,
                    stripeCustomerId: request.stripeCustomerId,
                    subscriptionStatus: request.subscriptionStatus,
                    subscriptionId: request.subscriptionId,
                    subscriptionInfo: {
                        upsert: {
                            create: {
                                id: uuid(),
                                userId: request.userId,
                                subscriptionId: request.subscriptionId,
                                subscriptionStatus: request.subscriptionStatus,
                                stripeCustomerId: request.stripeCustomerId,
                                stripeSubscriptionId:
                                    request.stripeSubscriptionId,
                                currentPeriodStart: periodStart,
                                currentPeriodEnd: periodEnd,
                                periods: {
                                    create: {
                                        id: periodId,
                                        invoiceId: invoiceId,
                                        invoice: {
                                            create: {
                                                id: invoiceId,
                                                subscription: {
                                                    connect: {
                                                        userId: request.userId,
                                                    },
                                                },
                                                ...request.invoice,
                                            },
                                        },
                                        periodEnd: periodEnd,
                                        periodStart: periodStart,
                                    },
                                },
                            },
                            update: {
                                periods: {
                                    create: {
                                        id: periodId,
                                        invoiceId: invoiceId,
                                        invoice: {
                                            create: {
                                                id: invoiceId,
                                                subscription: {
                                                    connect: {
                                                        userId: request.userId,
                                                    },
                                                },
                                                ...request.invoice,
                                            },
                                        },
                                        periodEnd: periodEnd,
                                        periodStart: periodStart,
                                    },
                                },
                            },
                        },
                    },
                },
            });
        } else if (request.studioId) {
            await this._client.studio.update({
                where: {
                    id: request.studioId,
                },
                data: {
                    subscriptionPeriodStart: periodStart,
                    subscriptionPeriodEnd: periodEnd,
                    stripeCustomerId: request.stripeCustomerId,
                    subscriptionStatus: request.subscriptionStatus,
                    subscriptionId: request.subscriptionId,
                    subscriptionInfo: {
                        upsert: {
                            create: {
                                id: uuid(),
                                studioId: request.studioId,
                                subscriptionId: request.subscriptionId,
                                subscriptionStatus: request.subscriptionStatus,
                                stripeCustomerId: request.stripeCustomerId,
                                stripeSubscriptionId:
                                    request.stripeSubscriptionId,
                                currentPeriodStart: periodStart,
                                currentPeriodEnd: periodEnd,
                                periods: {
                                    create: {
                                        id: periodId,
                                        invoiceId: invoiceId,
                                        invoice: {
                                            create: {
                                                id: invoiceId,
                                                subscription: {
                                                    connect: {
                                                        studioId:
                                                            request.studioId,
                                                    },
                                                },
                                                ...request.invoice,
                                            },
                                        },
                                        periodEnd: periodEnd,
                                        periodStart: periodStart,
                                    },
                                },
                            },
                            update: {
                                periods: {
                                    create: {
                                        id: periodId,
                                        invoiceId: invoiceId,
                                        invoice: {
                                            create: {
                                                id: invoiceId,
                                                subscription: {
                                                    connect: {
                                                        studioId:
                                                            request.studioId,
                                                    },
                                                },
                                                ...request.invoice,
                                            },
                                        },
                                        periodEnd: periodEnd,
                                        periodStart: periodStart,
                                    },
                                },
                            },
                        },
                    },
                },
            });
        }
    }

    async findUserLoginMetadata(
        userId: string
    ): Promise<UserLoginMetadata | null> {
        const [credentialIds, pushSubscriptionIds] = await Promise.all([
            this._client.userAuthenticator.findMany({
                where: {
                    userId: userId,
                },
                select: {
                    id: true,
                },
            }),
            this._client.pushSubscriptionUser.findMany({
                where: {
                    userId: userId,
                },
                select: {
                    pushSubscriptionId: true,
                },
            }),
        ]);

        return {
            hasUserAuthenticator: credentialIds.length > 0,
            userAuthenticatorCredentialIds: credentialIds.map((c) => c.id),
            hasPushSubscription: pushSubscriptionIds.length > 0,
            pushSubscriptionIds: pushSubscriptionIds.map(
                (p) => p.pushSubscriptionId
            ),
        };
    }

    private _convertToAuthUser(user: User | null): AuthUser | null {
        if (user) {
            return {
                id: user.id,
                email: user.email,
                phoneNumber: user.phoneNumber,
                name: user.name,
                avatarUrl: user.avatarUrl,
                avatarPortraitUrl: user.avatarPortraitUrl,
                stripeCustomerId: user.stripeCustomerId,
                allSessionRevokeTimeMs: convertToMillis(
                    user.allSessionRevokeTime
                ),
                currentLoginRequestId: user.currentLoginRequestId,
                subscriptionStatus:
                    user.subscriptionStatus as AuthUser['subscriptionStatus'],
                banTimeMs: convertToMillis(user.banTime),
                banReason: user.banReason as AuthUser['banReason'],
                subscriptionId: user.subscriptionId as string | undefined,
                privoServiceId: user.privoServiceId as string | undefined,
                privoParentServiceId: user.privoParentServiceId as
                    | string
                    | undefined,
                privoConsentUrl: user.privoConsentUrl,
                privacyFeatures: {
                    publishData: user.allowPublishData ?? true,
                    allowPublicData: user.allowPublicData ?? true,
                    allowAI: user.allowAI ?? true,
                    allowPublicInsts: user.allowPublicInsts ?? true,
                },
                currentWebAuthnChallenge: user.currentWebAuthnChallenge,
                subscriptionInfoId: user.subscriptionInfoId,
                subscriptionPeriodEndMs: convertToMillis(
                    user.subscriptionPeriodEnd
                ),
                subscriptionPeriodStartMs: convertToMillis(
                    user.subscriptionPeriodStart
                ),
                role: user.role as UserRole,
            };
        }
        return null;
    }

    private _convertToSession(session: PrismaSession): AuthSession {
        return {
            sessionId: session.sessionId,
            userId: session.userId,
            secretHash: session.secretHash,
            expireTimeMs: convertToMillis(session.expireTime) as number,
            grantedTimeMs: convertToMillis(session.grantedTime) as number,
            revokeTimeMs: convertToMillis(session.revokeTime) as number,
            requestId: session.requestId,
            previousSessionId: session.previousSessionId,
            ipAddress: session.ipAddress,
            nextSessionId: session.nextSessionId,
            connectionSecret: session.connectionSecret,

            revocable: session.revocable,

            oidProvider: session.oidProvider,
            oidAccessToken: session.oidAccessToken,
            oidIdToken: session.oidIdToken,
            oidExpiresAtMs:
                typeof session.oidExpiresAtMs === 'bigint'
                    ? Number(session.oidExpiresAtMs)
                    : session.oidExpiresAtMs,
            oidRefreshToken: session.oidRefreshToken,
            oidRequestId: session.oidRequestId,
            oidScope: session.oidScope,
            oidTokenType: session.oidTokenType,
            webauthnRequestId: session.webauthnRequestId,
        };
    }

    private _convertToSubscription(sub: PrismaSubscription): AuthSubscription {
        if (sub) {
            return {
                ...sub,
                currentPeriodEndMs: convertToMillis(sub.currentPeriodEnd),
                currentPeriodStartMs: convertToMillis(sub.currentPeriodStart),
            };
        }

        return null;
    }

    private _convertToSubscriptionPeriod(
        period: SubscriptionPeriod
    ): AuthSubscriptionPeriod {
        if (period) {
            return {
                ...period,
                periodEndMs: convertToMillis(period.periodEnd),
                periodStartMs: convertToMillis(period.periodStart),
            };
        }

        return null;
    }
}
