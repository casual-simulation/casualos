import { hasValue } from '@casual-simulation/aux-common';
import {
    RegexRule,
    Record,
    RecordsStore,
    RecordKey,
    StudioAssignment,
    Studio,
    ListedUserAssignment,
    CountRecordsFilter,
    ListStudioAssignmentFilters,
    ListedStudioAssignment,
    ListedRecord,
    StoreListedStudio,
} from '@casual-simulation/aux-records';
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
    PrivacyFeatures,
    SaveNewUserResult,
    UpdateSubscriptionInfoRequest,
    UpdateSubscriptionPeriodRequest,
} from '@casual-simulation/aux-records/AuthStore';
import { Db, Collection, FilterQuery } from 'mongodb';
import { v4 as uuid } from 'uuid';

export const USERS_COLLECTION_NAME = 'users';
export const LOGIN_REQUESTS_COLLECTION_NAME = 'loginRequests';
export const SESSIONS_COLLECTION_NAME = 'sessions';
export const EMAIL_RULES_COLLECTION_NAME = 'emailRules';
export const SMS_RULES_COLLECTION_NAME = 'smsRules';
export const SUBSCRIPTIONS_COLLECTION_NAME = 'subscriptions';
export const SUBSCRIPTION_PERIODS_COLLECTION_NAME = 'subscriptionPeriods';
export const INVOICES_COLLECTION_NAME = 'invoices';
export const RECORDS_COLLECTION_NAME = 'records';
export const RECORD_KEYS_COLLECTION_NAME = 'recordKeys';
export const STUDIOS_COLLECTION_NAME = 'studios';

export class MongoDBAuthStore implements AuthStore, RecordsStore {
    private _users: Collection<MongoDBAuthUser>;
    private _loginRequests: Collection<MongoDBLoginRequest>;
    private _sessions: Collection<MongoDBAuthSession>;
    private _emailRules: Collection<MongoDBEmailRule>;
    private _smsRules: Collection<MongoDBSmsRule>;
    private _subscriptions: Collection<MongoDBSubscription>;
    private _subscriptionPeriods: Collection<MongoDBSubscriptionPeriod>;
    private _invoices: Collection<MongoDBInvoice>;
    private _collection: Collection<Record>;
    private _keyCollection: Collection<RecordKey>;
    private _studios: Collection<MongoDBStudio>;

    private _db: Db;

    constructor(db: Db) {
        this._db = db;

        const users = db.collection<MongoDBAuthUser>(USERS_COLLECTION_NAME);
        const loginRequests = db.collection<MongoDBLoginRequest>(
            LOGIN_REQUESTS_COLLECTION_NAME
        );
        const sessions = db.collection<MongoDBAuthSession>(
            SESSIONS_COLLECTION_NAME
        );
        const emailRules = db.collection<any>(EMAIL_RULES_COLLECTION_NAME);
        const smsRules = db.collection<any>(SMS_RULES_COLLECTION_NAME);

        this._users = users;
        this._loginRequests = loginRequests;
        this._sessions = sessions;
        this._emailRules = emailRules;
        this._smsRules = smsRules;
        this._subscriptions = db.collection<MongoDBSubscription>(
            SUBSCRIPTIONS_COLLECTION_NAME
        );
        this._subscriptionPeriods = db.collection<MongoDBSubscriptionPeriod>(
            SUBSCRIPTION_PERIODS_COLLECTION_NAME
        );
        this._invoices = db.collection<MongoDBInvoice>(
            INVOICES_COLLECTION_NAME
        );
        this._collection = db.collection<Record>(RECORDS_COLLECTION_NAME);
        this._keyCollection = db.collection<RecordKey>(
            RECORD_KEYS_COLLECTION_NAME
        );
        this._studios = db.collection<MongoDBStudio>(STUDIOS_COLLECTION_NAME);
    }

    // TODO: Implement
    findOpenIDLoginRequest(requestId: string): Promise<AuthOpenIDLoginRequest> {
        throw new Error('Method not implemented.');
    }

    saveOpenIDLoginRequest(
        request: AuthOpenIDLoginRequest
    ): Promise<AuthOpenIDLoginRequest> {
        throw new Error('Method not implemented.');
    }

    markOpenIDLoginRequestComplete(
        requestId: string,
        completedTimeMs: number
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    saveOpenIDLoginRequestAuthorizationCode(
        requestId: string,
        authorizationCode: string,
        authorizationTimeMs: number
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    async listEmailRules(): Promise<RegexRule[]> {
        const result = await this._emailRules.find().toArray();

        return result.map((r) => ({
            type: r.type,
            pattern: r.pattern,
        }));
    }

    async listSmsRules(): Promise<RegexRule[]> {
        const result = await this._smsRules.find().toArray();

        return result.map((r) => ({
            type: r.type,
            pattern: r.pattern,
        }));
    }

    async findUser(userId: string): Promise<AuthUser> {
        const user = await this._users.findOne({
            _id: userId,
        });

        if (user) {
            const { _id, ...rest } = user;
            return {
                id: _id,
                ...rest,
            };
        }

        return null;
    }

    async findUserByStripeCustomerId(customerId: string): Promise<AuthUser> {
        const user = await this._users.findOne({
            stripeCustomerId: customerId,
        });

        if (user) {
            const { _id, ...rest } = user;
            return {
                id: _id,
                ...rest,
            };
        }

        return null;
    }

    async findUserByPrivoServiceId(serviceId: string): Promise<AuthUser> {
        const user = await this._users.findOne({
            privoServiceId: serviceId,
        });

        if (user) {
            const { _id, ...rest } = user;
            return {
                id: _id,
                ...rest,
            };
        }

        return null;
    }

    async setRevokeAllSessionsTimeForUser(
        userId: string,
        allSessionRevokeTimeMs: number
    ): Promise<void> {
        await this._users.updateOne(
            { _id: userId },
            {
                $set: {
                    allSessionRevokeTimeMs,
                },
            }
        );
    }

    async setCurrentLoginRequest(
        userId: string,
        requestId: string
    ): Promise<void> {
        await this._users.updateOne(
            { _id: userId },
            {
                $set: {
                    currentLoginRequestId: requestId,
                },
            }
        );
    }

    async findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser> {
        const user = await this._users.findOne(
            addressType === 'email'
                ? {
                      email: { $eq: address },
                  }
                : {
                      phoneNumber: { $eq: address },
                  }
        );

        if (user) {
            const { _id, ...rest } = user;
            return {
                id: _id,
                ...rest,
            };
        }

        return null;
    }

    async saveUser(user: AuthUser): Promise<void> {
        user.subscriptionStatus;
        await this._users.updateOne(
            { _id: user.id },
            {
                $set: {
                    _id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    avatarUrl: user.avatarUrl,
                    avatarPortraitUrl: user.avatarPortraitUrl,
                    allSessionRevokeTimeMs: user.allSessionRevokeTimeMs,
                    currentLoginRequestId: user.currentLoginRequestId,
                    stripeCustomerId: user.stripeCustomerId,
                    subscriptionStatus: user.subscriptionStatus,
                    subscriptionId: user.subscriptionId,
                    banTimeMs: user.banTimeMs,
                    banReason: user.banReason,
                    privoServiceId: user.privoServiceId,
                    privoParentServiceId: user.privoParentServiceId,
                },
            },
            {
                upsert: true,
            }
        );
    }

    async saveNewUser(user: AuthUser): Promise<SaveNewUserResult> {
        const filters = [
            user.email ? { email: { $eq: user.email } } : null,
            user.phoneNumber
                ? { phoneNumber: { $eq: user.phoneNumber } }
                : null,
        ].filter((a) => !!a);
        const existingUser = await this._users.findOne({
            $or: [...filters],
        });

        if (existingUser) {
            return {
                success: false,
                errorCode: 'user_already_exists',
                errorMessage: 'The user already exists.',
            };
        }

        await this._users.insertOne({
            _id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            avatarPortraitUrl: user.avatarPortraitUrl,
            avatarUrl: user.avatarUrl,
            allSessionRevokeTimeMs: user.allSessionRevokeTimeMs,
            currentLoginRequestId: user.currentLoginRequestId,
            stripeCustomerId: user.stripeCustomerId,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionId: user.subscriptionId,
            banTimeMs: user.banTimeMs,
            banReason: user.banReason,
            privoServiceId: user.privoServiceId,
            privoParentServiceId: user.privoParentServiceId,
        });

        return {
            success: true,
        };
    }

    async findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest> {
        const request = await this._loginRequests.findOne({
            _id: requestId,
            userId: { $eq: userId },
        });

        if (!request) {
            return null;
        }

        const { _id, ...rest } = request;
        return {
            requestId: request._id,
            ...rest,
        };
    }

    async findSession(userId: string, sessionId: string): Promise<AuthSession> {
        const session = await this._sessions.findOne({
            _id: sessionId,
            userId: { $eq: userId },
        });

        if (!session) {
            return null;
        }

        const { _id, ...rest } = session;
        return {
            sessionId: session._id,
            ...rest,
        };
    }

    async saveLoginRequest(
        request: AuthLoginRequest
    ): Promise<AuthLoginRequest> {
        await this._loginRequests.updateOne(
            {
                _id: request.requestId,
                userId: { $eq: request.userId },
            },
            {
                $set: {
                    _id: request.requestId,
                    userId: request.userId,
                    secretHash: request.secretHash,
                    requestTimeMs: request.requestTimeMs,
                    completedTimeMs: request.completedTimeMs,
                    expireTimeMs: request.expireTimeMs,
                    attemptCount: request.attemptCount,
                    address: request.address,
                    addressType: request.addressType,
                    ipAddress: request.ipAddress,
                },
            },
            {
                upsert: true,
            }
        );

        return request;
    }

    async markLoginRequestComplete(
        userId: string,
        requestId: string,
        completedTimeMs: number
    ): Promise<void> {
        const request = await this._loginRequests.findOne({
            _id: requestId,
            userId: { $eq: userId },
        });

        if (!request) {
            return;
        }

        await this._loginRequests.updateOne(
            {
                _id: requestId,
                userId: { $eq: userId },
            },
            {
                $set: {
                    completedTimeMs: completedTimeMs,
                },
            }
        );
    }

    async incrementLoginRequestAttemptCount(
        userId: string,
        requestId: string
    ): Promise<void> {
        const result = await this._loginRequests.updateOne(
            {
                _id: { $eq: requestId },
                userId: { $eq: userId },
            },
            {
                $inc: { attemptCount: 1 },
            }
        );
    }

    async saveSession(session: AuthSession): Promise<void> {
        const result = await this._sessions.updateOne(
            {
                _id: { $eq: session.sessionId },
                userId: { $eq: session.userId },
            },
            {
                $set: {
                    _id: session.sessionId,
                    userId: session.userId,
                    secretHash: session.secretHash,
                    grantedTimeMs: session.grantedTimeMs,
                    expireTimeMs: session.expireTimeMs,
                    revokeTimeMs: session.revokeTimeMs,
                    requestId: session.requestId,
                    previousSessionId: session.previousSessionId,
                    nextSessionId: session.nextSessionId,
                    ipAddress: session.ipAddress,
                    connectionSecret: session.connectionSecret,
                },
            },
            {
                upsert: true,
            }
        );
    }

    async replaceSession(
        session: AuthSession,
        newSession: AuthSession,
        revokeTimeMs: number
    ): Promise<void> {
        await this.saveSession({
            ...session,
            revokeTimeMs: revokeTimeMs,
            nextSessionId: newSession.sessionId,
        });
        await this.saveSession({
            ...newSession,
            previousSessionId: session.sessionId,
        });
    }

    async listSessions(
        userId: string,
        expireTimeMs: number
    ): Promise<ListSessionsDataResult> {
        let query: FilterQuery<AuthSession> = {
            userId: userId,
        };
        if (expireTimeMs) {
            query['expireTimeMs'] = { $lt: expireTimeMs };
        }
        const sessions = await this._sessions
            .find(query, {
                sort: {
                    expireTimeMs: -1,
                },
                limit: 10,
            })
            .toArray();

        return {
            success: true,
            sessions: sessions.map((s) => {
                let { _id, ...rest } = s;
                return {
                    sessionId: _id,
                    ...rest,
                };
            }),
        };
    }

    async saveSubscription(subscription: AuthSubscription): Promise<void> {
        await this._subscriptions.updateOne(
            {
                id: subscription.id,
            },
            {
                $set: {
                    ...subscription,
                    _id: subscription.id,
                },
            },
            { upsert: true }
        );
    }

    async getSubscriptionById(id: string): Promise<AuthSubscription> {
        return await this._subscriptions.findOne({
            _id: id,
        });
    }

    async getSubscriptionByStripeSubscriptionId(
        id: string
    ): Promise<AuthSubscription> {
        return await this._subscriptions.findOne({
            stripeSubscriptionId: id,
        });
    }

    async saveSubscriptionPeriod(
        period: AuthSubscriptionPeriod
    ): Promise<void> {
        await this._subscriptionPeriods.updateOne(
            {
                _id: period.id,
            },
            {
                $set: {
                    ...period,
                    _id: period.id,
                },
            },
            { upsert: true }
        );
    }

    async getSubscriptionPeriodById(
        id: string
    ): Promise<AuthSubscriptionPeriod> {
        const period = await this._subscriptionPeriods.findOne({
            _id: id,
        });

        return period;
    }

    async listSubscriptionPeriodsBySubscriptionId(
        subscriptionId: string
    ): Promise<AuthSubscriptionPeriod[]> {
        const periods = await this._subscriptionPeriods
            .find({
                subscriptionId,
            })
            .toArray();

        return periods;
    }

    async saveInvoice(invoice: AuthInvoice): Promise<void> {
        await this._invoices.updateOne(
            {
                _id: invoice.id,
            },
            {
                $set: {
                    ...invoice,
                    _id: invoice.id,
                },
            },
            { upsert: true }
        );
    }

    async getInvoiceById(id: string): Promise<AuthInvoice> {
        const invoice = await this._invoices.findOne({
            _id: id,
        });

        return invoice;
    }

    async updateSubscriptionInfo(
        request: UpdateSubscriptionInfoRequest
    ): Promise<void> {
        if (request.userId) {
            const user = await this.findUser(request.userId);
            let subscription = await this.getSubscriptionByStripeSubscriptionId(
                request.stripeSubscriptionId
            );

            if (subscription) {
                await this.saveSubscription({
                    ...subscription,
                    stripeCustomerId: request.stripeCustomerId,
                    stripeSubscriptionId: request.stripeSubscriptionId,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    currentPeriodEndMs: request.currentPeriodEndMs,
                    currentPeriodStartMs: request.currentPeriodStartMs,
                });
            } else {
                subscription = {
                    id: uuid(),
                    userId: user.id,
                    studioId: null,
                    stripeCustomerId: request.stripeCustomerId,
                    stripeSubscriptionId: request.stripeSubscriptionId,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    currentPeriodEndMs: request.currentPeriodEndMs,
                    currentPeriodStartMs: request.currentPeriodStartMs,
                };

                await this.saveSubscription(subscription);
            }

            await this.saveUser({
                ...user,
                subscriptionId: request.subscriptionId,
                subscriptionStatus: request.subscriptionStatus,
                stripeCustomerId: request.stripeCustomerId,
                subscriptionPeriodStartMs: request.currentPeriodStartMs,
                subscriptionPeriodEndMs: request.currentPeriodEndMs,
                subscriptionInfoId: subscription.id,
            });
        } else if (request.studioId) {
            const studio = await this.getStudioById(request.studioId);
            let subscription = await this.getSubscriptionByStripeSubscriptionId(
                request.stripeSubscriptionId
            );

            if (subscription) {
                await this.saveSubscription({
                    ...subscription,
                    stripeCustomerId: request.stripeCustomerId,
                    stripeSubscriptionId: request.stripeSubscriptionId,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    currentPeriodEndMs: request.currentPeriodEndMs,
                    currentPeriodStartMs: request.currentPeriodStartMs,
                });
            } else {
                subscription = {
                    id: uuid(),
                    userId: null,
                    studioId: studio.id,
                    stripeCustomerId: request.stripeCustomerId,
                    stripeSubscriptionId: request.stripeSubscriptionId,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    currentPeriodEndMs: request.currentPeriodEndMs,
                    currentPeriodStartMs: request.currentPeriodStartMs,
                };

                await this.saveSubscription(subscription);
            }

            await this.updateStudio({
                ...studio,
                subscriptionId: request.subscriptionId,
                subscriptionStatus: request.subscriptionStatus,
                stripeCustomerId: request.stripeCustomerId,
                subscriptionPeriodStartMs: request.currentPeriodStartMs,
                subscriptionPeriodEndMs: request.currentPeriodEndMs,
                subscriptionInfoId: subscription.id,
            });
        }
    }

    async updateSubscriptionPeriod(
        request: UpdateSubscriptionPeriodRequest
    ): Promise<void> {
        if (request.userId) {
            let user = await this.findUser(request.userId);
            let subscription = await this.getSubscriptionByStripeSubscriptionId(
                request.stripeSubscriptionId
            );

            if (!subscription) {
                subscription = {
                    id: uuid(),
                    userId: user.id,
                    studioId: null,
                    stripeCustomerId: request.stripeCustomerId,
                    stripeSubscriptionId: request.stripeSubscriptionId,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    currentPeriodEndMs: request.currentPeriodEndMs,
                    currentPeriodStartMs: request.currentPeriodStartMs,
                };

                user.stripeCustomerId = request.stripeCustomerId;
                user.subscriptionStatus = request.subscriptionStatus;
                user.subscriptionId = request.subscriptionId;
                user.subscriptionInfoId = subscription.id;

                await this.saveSubscription(subscription);
            }

            await this.saveUser({
                ...user,
                subscriptionPeriodStartMs: request.currentPeriodStartMs,
                subscriptionPeriodEndMs: request.currentPeriodEndMs,
            });

            const periodId: string = uuid();
            const invoiceId: string = uuid();

            await this.saveInvoice({
                id: invoiceId,
                periodId: periodId,
                subscriptionId: subscription.id,
                ...request.invoice,
            });

            await this.saveSubscriptionPeriod({
                id: periodId,
                invoiceId: invoiceId,
                subscriptionId: subscription.id,
                periodEndMs: request.currentPeriodEndMs,
                periodStartMs: request.currentPeriodStartMs,
            });
        } else if (request.studioId) {
            let studio = await this.getStudioById(request.studioId);
            let subscription = await this.getSubscriptionByStripeSubscriptionId(
                request.stripeSubscriptionId
            );

            if (!subscription) {
                subscription = {
                    id: uuid(),
                    userId: null,
                    studioId: studio.id,
                    stripeCustomerId: request.stripeCustomerId,
                    stripeSubscriptionId: request.stripeSubscriptionId,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionStatus,
                    currentPeriodEndMs: request.currentPeriodEndMs,
                    currentPeriodStartMs: request.currentPeriodStartMs,
                };

                studio.stripeCustomerId = request.stripeCustomerId;
                studio.subscriptionStatus = request.subscriptionStatus;
                studio.subscriptionId = request.subscriptionId;
                studio.subscriptionInfoId = subscription.id;

                await this.saveSubscription(subscription);
            }

            await this.updateStudio({
                ...studio,
                subscriptionPeriodStartMs: request.currentPeriodStartMs,
                subscriptionPeriodEndMs: request.currentPeriodEndMs,
            });

            const periodId: string = uuid();
            const invoiceId: string = uuid();

            await this.saveInvoice({
                id: invoiceId,
                periodId: periodId,
                subscriptionId: subscription.id,
                ...request.invoice,
            });

            await this.saveSubscriptionPeriod({
                id: periodId,
                invoiceId: invoiceId,
                subscriptionId: subscription.id,
                periodEndMs: request.currentPeriodEndMs,
                periodStartMs: request.currentPeriodStartMs,
            });
        }
    }

    async updateRecord(record: Record): Promise<void> {
        await this._collection.updateOne(
            {
                name: record.name,
            },
            {
                $set: record,
            },
            { upsert: true }
        );
    }

    async addRecord(record: Record): Promise<void> {
        await this._collection.insertOne(record);
    }

    async getRecordByName(name: string): Promise<Record> {
        const record = await this._collection.findOne({
            name: name,
        });

        return record;
    }

    /**
     * Adds the given record key to the store.
     * @param key The key to add.
     */
    async addRecordKey(key: RecordKey): Promise<void> {
        await this._keyCollection.insertOne(key);
    }

    /**
     * Gets the record key for the given record name that has the given hash.
     * @param recordName The name of the record.
     * @param hash The scrypt hash of the key that should be retrieved.
     */
    async getRecordKeyByRecordAndHash(
        recordName: string,
        hash: string
    ): Promise<RecordKey> {
        const key = await this._keyCollection.findOne({
            recordName: recordName,
            secretHash: hash,
        });

        return key;
    }

    listRecordsByOwnerId(ownerId: string): Promise<ListedRecord[]> {
        return this._collection.find({ ownerId: ownerId }).toArray();
    }

    listRecordsByStudioId(studioId: string): Promise<ListedRecord[]> {
        return this._collection.find({ studioId: studioId }).toArray();
    }

    async listRecordsByStudioIdAndUserId(
        studioId: string,
        userId: string
    ): Promise<ListedRecord[]> {
        const studio = await this._studios.findOne({
            studioId: studioId,
        });

        if (!studio) {
            return [];
        }

        const isAssigned = studio.assignments.some((a) => a.userId === userId);

        if (!isAssigned) {
            return [];
        }

        return this.listRecordsByStudioId(studioId);
    }

    async addStudio(studio: Studio): Promise<void> {
        this._studios.insertOne({
            ...studio,
            _id: studio.id,
            assignments: [],
        });
    }

    async createStudioForUser(
        studio: Studio,
        adminId: string
    ): Promise<{ studio: Studio; assignment: StudioAssignment }> {
        await this.addStudio(studio);
        const assignment: StudioAssignment = {
            studioId: studio.id,
            userId: adminId,
            isPrimaryContact: true,
            role: 'admin',
        };
        await this.addStudioAssignment(assignment);

        return {
            studio,
            assignment,
        };
    }

    async updateStudio(studio: Studio): Promise<void> {
        await this._studios.updateOne(
            {
                _id: studio.id,
            },
            {
                $set: {
                    displayName: studio.displayName,
                    stripeCustomerId: studio.stripeCustomerId,
                    subscriptionId: studio.subscriptionId,
                    subscriptionStatus: studio.subscriptionStatus,
                },
            },
            { upsert: true }
        );
    }

    async getStudioById(id: string): Promise<Studio> {
        const studio = await this._studios.findOne({
            _id: id,
        });

        if (!studio) {
            return null;
        }

        return {
            id: studio._id,
            displayName: studio.displayName,
            stripeCustomerId: studio.stripeCustomerId,
            subscriptionId: studio.subscriptionId,
            subscriptionStatus: studio.subscriptionStatus,
        };
    }

    async getStudioByStripeCustomerId(customerId: string): Promise<Studio> {
        const studio = await this._studios.findOne({
            stripeCustomerId: customerId,
        });

        if (!studio) {
            return null;
        }

        return {
            id: studio._id,
            displayName: studio.displayName,
            stripeCustomerId: studio.stripeCustomerId,
            subscriptionId: studio.subscriptionId,
            subscriptionStatus: studio.subscriptionStatus,
        };
    }

    async listStudiosForUser(userId: string): Promise<StoreListedStudio[]> {
        const studios = await this._studios
            .find({
                assignments: {
                    $elemMatch: {
                        userId: userId,
                    },
                },
            })
            .toArray();

        return studios.map((s) => {
            const assignment = s.assignments.find((a) => a.userId === userId);
            return {
                studioId: s._id,
                displayName: s.displayName,
                role: assignment.role,
                isPrimaryContact: assignment.isPrimaryContact,
                subscriptionId: s.subscriptionId,
                subscriptionStatus: s.subscriptionStatus,
            };
        });
    }

    async addStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const studio = await this._studios.findOne({
            _id: assignment.studioId,
        });

        if (!studio) {
            return;
        }

        studio.assignments.push(assignment);

        await this._studios.updateOne(
            {
                _id: assignment.studioId,
            },
            {
                $set: {
                    assignments: studio.assignments,
                },
            }
        );
    }

    async removeStudioAssignment(
        studioId: string,
        userId: string
    ): Promise<void> {
        const studio = await this._studios.findOne({
            _id: studioId,
        });

        if (!studio) {
            return;
        }

        studio.assignments = studio.assignments.filter(
            (a) => a.userId !== userId
        );

        await this._studios.updateOne(
            {
                _id: studioId,
            },
            {
                $set: {
                    assignments: studio.assignments,
                },
            }
        );
    }

    async updateStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const studioId = assignment.studioId;
        const userId = assignment.userId;
        const studio = await this._studios.findOne({
            _id: studioId,
        });

        if (!studio) {
            return;
        }

        const index = studio.assignments.findIndex((a) => a.userId === userId);

        if (index < 0) {
            return;
        }
        studio.assignments[index] = assignment;

        await this._studios.updateOne(
            {
                _id: studioId,
            },
            {
                $set: {
                    assignments: studio.assignments,
                },
            }
        );
    }

    async listStudioAssignments(
        studioId: string,
        filters?: ListStudioAssignmentFilters
    ): Promise<ListedStudioAssignment[]> {
        let query: FilterQuery<MongoDBStudio> = {
            _id: studioId,
        };

        if (hasValue(filters?.role)) {
            query['assignments.role'] = filters.role;
        }

        if (hasValue(filters?.userId)) {
            query['assignments.userId'] = filters.userId;
        }

        if (hasValue(filters?.isPrimaryContact)) {
            query['assignments.isPrimaryContact'] = filters.isPrimaryContact;
        }

        const studio = await this._studios.findOne(query);

        if (!studio) {
            return [];
        }

        let assignments: ListedStudioAssignment[] = [];

        for (let a of studio.assignments) {
            let user = await this.findUser(a.userId);
            if (!user) {
                continue;
            }
            assignments.push({
                studioId: a.studioId,
                userId: a.userId,
                isPrimaryContact: a.isPrimaryContact,
                role: a.role,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                },
            });
        }

        return assignments;
    }

    async listUserAssignments(userId: string): Promise<ListedUserAssignment[]> {
        const studios = await this._studios
            .find({
                assignments: {
                    $elemMatch: {
                        userId: userId,
                    },
                },
            })
            .toArray();

        let assignments: ListedUserAssignment[] = [];

        for (let s of studios) {
            for (let a of s.assignments.filter((a) => a.userId === userId)) {
                assignments.push({
                    userId: a.userId,
                    studioId: a.studioId,
                    isPrimaryContact: a.isPrimaryContact,
                    role: a.role,
                    displayName: s.displayName,
                });
            }
        }

        return assignments;
    }

    async countRecords(filter: CountRecordsFilter): Promise<number> {
        let query: FilterQuery<Record> = {};

        if (hasValue(filter.studioId)) {
            query.studioId = filter.studioId;
        }

        if (hasValue(filter.ownerId)) {
            query.ownerId = filter.ownerId;
        }

        return await this._collection.count(query);
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
    subscriptionPeriodStartMs?: number;
    subscriptionPeriodEndMs?: number;
    banTimeMs?: number;
    banReason?: AuthUser['banReason'];

    privoServiceId?: string;
    privoParentServiceId?: string;

    privacyFeatures?: PrivacyFeatures;
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
     * The secret of the token that provides connection access to this session.
     */
    connectionSecret: string;

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

export interface MongoDBSubscription extends AuthSubscription {
    _id: string;
}

export interface MongoDBSubscriptionPeriod extends AuthSubscriptionPeriod {
    _id: string;
}

export interface MongoDBInvoice extends AuthInvoice {
    _id: string;
}

export interface MongoDBStudio extends Studio {
    _id: string;
    assignments: StudioAssignment[];
}
