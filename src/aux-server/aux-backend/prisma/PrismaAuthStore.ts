import { RegexRule, cleanupObject } from '@casual-simulation/aux-records';
import {
    AddressType,
    AuthInvoice,
    AuthLoginRequest,
    AuthOpenIDLoginRequest,
    AuthSession,
    AuthStore,
    AuthSubscription,
    AuthSubscriptionPeriod,
    AuthUser,
    ListSessionsDataResult,
    SaveNewUserResult,
    UpdateSubscriptionInfoRequest,
    UpdateSubscriptionPeriodRequest,
} from '@casual-simulation/aux-records/AuthStore';
import {
    LoginRequest,
    Prisma,
    PrismaClient,
    User,
    AuthSession as PrismaSession,
    Subscription as PrismaSubscription,
    SubscriptionPeriod,
} from './generated';
// import { PrismaClientKnownRequestError } from './generated/runtime';
import { convertToDate, convertToMillis } from './Utils';
import { v4 as uuid } from 'uuid';

export class PrismaAuthStore implements AuthStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async listEmailRules(): Promise<RegexRule[]> {
        const rules = await this._client.emailRule.findMany();
        return rules.map((r) => ({
            type: r.type as RegexRule['type'],
            pattern: r.pattern,
        }));
    }

    async listSmsRules(): Promise<RegexRule[]> {
        const rules = await this._client.smsRule.findMany();
        return rules.map((r) => ({
            type: r.type as RegexRule['type'],
            pattern: r.pattern,
        }));
    }

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

    async findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser | null> {
        if (!address) {
            return null;
        }
        const user = await this._client.user.findUnique({
            where:
                addressType === 'email'
                    ? {
                          email: address,
                      }
                    : {
                          phoneNumber: address,
                      },
        });

        return this._convertToAuthUser(user);
    }

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
            banTime: convertToDate(user.banTimeMs),
            banReason: user.banReason as string,
            privoServiceId: user.privoServiceId as string,
            privoParentServiceId: user.privoParentServiceId as string,
            allowPublishData: user.privacyFeatures?.publishData ?? true,
            allowPublicData: user.privacyFeatures?.allowPublicData ?? true,
            allowAI: user.privacyFeatures?.allowAI ?? true,
            allowPublicInsts: user.privacyFeatures?.allowPublicInsts ?? true,
        };

        await this._client.user.upsert({
            where: {
                id: user.id,
            },
            create: userData,
            update: userData,
        });
    }

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
                banTime: convertToDate(user.banTimeMs),
                banReason: user.banReason as string,
                privoServiceId: user.privoServiceId as string,
                privoParentServiceId: user.privoParentServiceId as string,
                allowPublishData: user.privacyFeatures?.publishData ?? true,
                allowPublicData: user.privacyFeatures?.allowPublicData ?? true,
                allowAI: user.privacyFeatures?.allowAI ?? true,
                allowPublicInsts:
                    user.privacyFeatures?.allowPublicInsts ?? true,
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
        };
        await this._client.authSession.upsert({
            where: {
                sessionId: session.sessionId,
            },
            create: sessionData,
            update: sessionData,
        });
    }

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
                    },
                },
            },
        });
    }

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
    async updateSubscriptionInfo(
        request: UpdateSubscriptionInfoRequest
    ): Promise<void> {
        const periodStart = convertToDate(request.currentPeriodStartMs);
        const periodEnd = convertToDate(request.currentPeriodEndMs);
        if (request.userId) {
            await this._client.user.update({
                where: {
                    id: request.userId,
                },
                data: {
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    stripeCustomerId: request.stripeCustomerId,
                    subscriptionPeriodStart: periodStart,
                    subscriptionPeriodEnd: periodEnd,
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
                            },
                            update: {
                                subscriptionId: request.subscriptionId,
                                subscriptionStatus: request.subscriptionStatus,
                                stripeCustomerId: request.stripeCustomerId,
                                stripeSubscriptionId:
                                    request.stripeSubscriptionId,
                                currentPeriodStart: periodStart,
                                currentPeriodEnd: periodEnd,
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
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    stripeCustomerId: request.stripeCustomerId,
                    subscriptionPeriodStart: periodStart,
                    subscriptionPeriodEnd: periodEnd,
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
                            },
                            update: {
                                subscriptionId: request.subscriptionId,
                                subscriptionStatus: request.subscriptionStatus,
                                stripeCustomerId: request.stripeCustomerId,
                                stripeSubscriptionId:
                                    request.stripeSubscriptionId,
                                currentPeriodStart: periodStart,
                                currentPeriodEnd: periodEnd,
                            },
                        },
                    },
                },
            });
        }
    }

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
                privacyFeatures: {
                    publishData: user.allowPublishData ?? true,
                    allowPublicData: user.allowPublicData ?? true,
                    allowAI: user.allowAI ?? true,
                    allowPublicInsts: user.allowPublicInsts ?? true,
                },
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
