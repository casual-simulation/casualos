import { RegexRule, cleanupObject } from '@casual-simulation/aux-records';
import {
    AddressType,
    AuthInvoice,
    AuthLoginRequest,
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
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
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
        const user = await this._client.user.findUnique({
            where: {
                stripeCustomerId: customerId,
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
        const userData = {
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
            if (err instanceof PrismaClientKnownRequestError) {
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

    async findSession(
        userId: string,
        sessionId: string
    ): Promise<AuthSession | null> {
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
                    },
                },
            },
        });
    }

    async listSessions(
        userId: string,
        expireTimeMs: number
    ): Promise<ListSessionsDataResult> {
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

export interface MongoDBAuthUser {
    _id: string;
    name: string;
    email: string;
    phoneNumber: string;
    avatarPortraitUrl: string;
    avatarUrl: string;
    allSessionRevokeTimeMs: number;
    currentLoginRequestId: string;
    stripeCustomerId?: string;
    subscriptionStatus?: string;
    subscriptionId?: string;
    banTimeMs?: number;
    banReason?: AuthUser['banReason'];
}

export interface MongoDBLoginRequest {
    _id: string;
    userId: string;
    secretHash: string;
    requestTimeMs: number;
    expireTimeMs: number;
    completedTimeMs: number | null;
    attemptCount: number;
    address: string;
    addressType: AddressType;
    ipAddress: string;
}

/**
 * Defines an interface that represents a login session for the user.
 */
export interface MongoDBAuthSession {
    /**
     * The ID of the session.
     */
    _id: string;

    /**
     * The ID of the user that the session is for.
     */
    userId: string;

    /**
     * The hash of the token that provides access to this session.
     */
    secretHash: string;

    /**
     * The unix timestamp in miliseconds that the session was granted at.
     */
    grantedTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the session will expire at.
     */
    expireTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the session was revoked at.
     * If null, then the session has not been revoked.
     */
    revokeTimeMs: number | null;

    /**
     * The ID of the login request that was used to obtain this session.
     */
    requestId: string | null;

    /**
     * The ID of the previous session that was used to obtain this session.
     */
    previousSessionId: string | null;

    /**
     * The ID of the session that replaced this session.
     */
    nextSessionId: string | null;

    /**
     * The IP Address that the session was granted to.
     */
    ipAddress: string;
}

/**
 * Defines an interface that represents an email rule stored in MongoDB.
 */
export interface MongoDBEmailRule extends RegexRule {
    /**
     * The ID of the rule.
     */
    _id: string;
}

/**
 * Defines an interface that represents an sms rule stored in MongoDB.
 */
export interface MongoDBSmsRule extends RegexRule {
    /**
     * The ID of the rule.
     */
    _id: string;
}
