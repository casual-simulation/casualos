import { sortBy } from 'lodash';
import { RegexRule } from './Utils';
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
} from './AuthStore';
import {
    ListStudioAssignmentFilters,
    ListedStudioAssignment,
    ListedUserAssignment,
    RecordsStore,
    Studio,
    Record,
    RecordKey,
    StudioAssignment,
    CountRecordsFilter,
    ListedRecord,
    StoreListedStudio,
} from './RecordsStore';
import { v4 as uuid } from 'uuid';
import {
    DataRecordsStore,
    EraseDataStoreResult,
    GetDataStoreResult,
    ListDataStoreResult,
    ListedDataStoreItem,
    SetDataResult,
    UserPolicy,
} from './DataRecordsStore';
import {
    AddFileResult,
    EraseFileStoreResult,
    FileRecord,
    FileRecordsLookup,
    FileRecordsStore,
    GetFileNameFromUrlResult,
    GetFileRecordResult,
    ListFilesLookupResult,
    ListFilesStoreResult,
    MarkFileRecordAsUploadedResult,
    PresignFileReadRequest,
    PresignFileReadResult,
    PresignFileUploadRequest,
    PresignFileUploadResult,
    UpdateFileResult,
} from './FileRecordsStore';
import {
    AddEventCountStoreResult,
    EventRecordUpdate,
    EventRecordsStore,
    GetEventCountStoreResult,
    ListEventsStoreResult,
    UpdateEventResult,
} from './EventRecordsStore';
import {
    AssignedRole,
    GetUserPolicyResult,
    ListUserPoliciesStoreResult,
    ListedRoleAssignments,
    ListedUserPolicy,
    PolicyStore,
    RoleAssignment,
    UpdateRolesUpdate,
    UpdateUserPolicyResult,
    UpdateUserRolesResult,
    UserPolicyRecord,
    getExpireTime,
} from './PolicyStore';
import {
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    PUBLIC_READ_MARKER,
    PolicyDocument,
} from './PolicyPermissions';
import {
    AIChatMetrics,
    AIImageMetrics,
    AISkyboxMetrics,
    AIChatSubscriptionMetrics,
    DataSubscriptionMetrics,
    EventSubscriptionMetrics,
    FileSubscriptionMetrics,
    MetricsStore,
    RecordSubscriptionMetrics,
    SubscriptionFilter,
    SubscriptionMetrics,
    AIImageSubscriptionMetrics,
    AISkyboxSubscriptionMetrics,
} from './MetricsStore';
import { ConfigurationStore } from './ConfigurationStore';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { DateTime } from 'luxon';
import {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    CurrentUpdates,
    InstRecord,
    InstRecordsStore,
    InstWithBranches,
    ReplaceUpdatesResult,
    SaveBranchResult,
    SaveInstResult,
    StoredUpdates,
} from './websockets';

export interface MemoryConfiguration {
    subscriptions: SubscriptionConfiguration;
}

export class MemoryStore
    implements
        AuthStore,
        RecordsStore,
        DataRecordsStore,
        FileRecordsStore,
        EventRecordsStore,
        PolicyStore,
        MetricsStore,
        ConfigurationStore,
        InstRecordsStore
{
    private _users: AuthUser[] = [];
    private _loginRequests: AuthLoginRequest[] = [];
    private _sessions: AuthSession[] = [];
    private _subscriptions: AuthSubscription[] = [];
    private _periods: AuthSubscriptionPeriod[] = [];
    private _invoices: AuthInvoice[] = [];

    private _records: Record[] = [];
    private _recordKeys: RecordKey[] = [];
    private _studios: Studio[] = [];
    private _studioAssignments: StudioAssignment[] = [];

    private _aiChatMetrics: AIChatMetrics[] = [];
    private _aiImageMetrics: AIImageMetrics[] = [];
    private _aiSkyboxMetrics: AISkyboxMetrics[] = [];

    private _dataBuckets: Map<string, Map<string, RecordData>> = new Map();
    private _eventBuckets: Map<string, Map<string, EventData>> = new Map();

    private _files: Map<string, StoredFile> = new Map();
    private _fileUploadUrl: string = 'http://localhost:9191';

    private _emailRules: RegexRule[] = [];
    private _smsRules: RegexRule[] = [];

    private _instRecords: Map<string, Map<string, InstWithUpdates>> = new Map();

    private _subscriptionConfiguration: SubscriptionConfiguration | null;

    maxAllowedInstSize: number = Infinity;

    policies: {
        [recordName: string]: {
            [marker: string]: {
                document: PolicyDocument;
                markers: string[];
            };
        };
    };

    roles: {
        [recordName: string]: {
            [userId: string]: Set<string>;
        };
    };

    roleAssignments: {
        [recordName: string]: {
            [userId: string]: {
                role: string;
                expireTimeMs: number | null;
            }[];
        };
    };

    get users(): AuthUser[] {
        return this._users;
    }

    get loginRequests() {
        return this._loginRequests;
    }

    get sessions() {
        return this._sessions;
    }

    get emailRules() {
        return this._emailRules;
    }

    get smsRules() {
        return this._smsRules;
    }

    get recordKeys() {
        return this._recordKeys;
    }

    get dataBuckets() {
        return this._dataBuckets;
    }

    get eventBuckets() {
        return this._eventBuckets;
    }

    get files() {
        return this._files;
    }

    get subscriptionConfiguration() {
        return this._subscriptionConfiguration;
    }

    set subscriptionConfiguration(value: SubscriptionConfiguration | null) {
        this._subscriptionConfiguration = value;
    }

    constructor(config: MemoryConfiguration) {
        this._subscriptionConfiguration = config.subscriptions;
        this.policies = {};
        this.roles = {};
        this.roleAssignments = {};
    }

    async getSubscriptionConfiguration(): Promise<SubscriptionConfiguration | null> {
        return this._subscriptionConfiguration;
    }

    async getRecordByName(name: string): Promise<Record> {
        const record = this._records.find((r) => r.name === name);
        return record;
    }

    async updateRecord(record: Record): Promise<void> {
        const existingRecordIndex = this._records.findIndex(
            (r) => r.name === record.name
        );
        if (existingRecordIndex >= 0) {
            this._records[existingRecordIndex] = record;
        }
    }

    async addRecord(record: Record): Promise<void> {
        const existingRecordIndex = this._records.findIndex(
            (r) => r.name === record.name
        );
        if (existingRecordIndex < 0) {
            this._records.push(record);
        }
    }

    async addRecordKey(key: RecordKey): Promise<void> {
        const existingKeyIndex = this._recordKeys.findIndex(
            (k) =>
                k.recordName === key.recordName &&
                k.secretHash === key.secretHash
        );
        if (existingKeyIndex < 0) {
            this._recordKeys.push(key);
        }
    }

    async getRecordKeyByRecordAndHash(
        recordName: string,
        hash: string
    ): Promise<RecordKey> {
        const key = this._recordKeys.find(
            (k) => k.recordName === recordName && k.secretHash == hash
        );
        return key;
    }

    async listRecordsByOwnerId(ownerId: string): Promise<ListedRecord[]> {
        return sortBy(
            this._records
                .filter((r) => r.ownerId === ownerId)
                .map((r) => ({
                    name: r.name,
                    ownerId: r.ownerId,
                    studioId: r.studioId,
                })),
            (r) => r.name
        );
    }

    async listRecordsByStudioId(studioId: string): Promise<ListedRecord[]> {
        return sortBy(
            this._records
                .filter((r) => r.studioId === studioId)
                .map((r) => ({
                    name: r.name,
                    ownerId: r.ownerId,
                    studioId: r.studioId,
                })),
            (r) => r.name
        );
    }

    async listRecordsByStudioIdAndUserId(
        studioId: string,
        userId: string
    ): Promise<ListedRecord[]> {
        return sortBy(
            this._records
                .filter((s) => {
                    if (s.studioId !== studioId) {
                        return false;
                    }

                    const isAssigned = this._studioAssignments.some(
                        (a) => a.studioId === studioId && a.userId === userId
                    );
                    return isAssigned;
                })
                .map((r) => ({
                    name: r.name,
                    ownerId: r.ownerId,
                    studioId: r.studioId,
                })),
            (r) => r.name
        );
    }

    async addStudio(studio: Studio): Promise<void> {
        const existingStudioIndex = this._studios.findIndex(
            (r) => r.id === studio.id
        );
        if (existingStudioIndex < 0) {
            this._studios.push(studio);
        }
    }

    async createStudioForUser(
        studio: Studio,
        adminId: string
    ): Promise<{
        studio: Studio;
        assignment: StudioAssignment;
    }> {
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
        const existingStudioIndex = this._studios.findIndex(
            (r) => r.id === studio.id
        );
        if (existingStudioIndex >= 0) {
            this._studios[existingStudioIndex] = studio;
        }
    }

    async getStudioById(id: string): Promise<Studio> {
        return this._studios.find((s) => s.id === id);
    }

    async getStudioByStripeCustomerId(customerId: string): Promise<Studio> {
        return this._studios.find((s) => s.stripeCustomerId === customerId);
    }

    async listStudiosForUser(userId: string): Promise<StoreListedStudio[]> {
        const assignments = await this.listUserAssignments(userId);
        const studios = await Promise.all(
            assignments.map(async (a) => {
                const s = await this.getStudioById(a.studioId);
                return {
                    ...s,
                    ...a,
                };
            })
        );
        return studios.map((s) => ({
            studioId: s.id,
            displayName: s.displayName,
            role: s.role,
            isPrimaryContact: s.isPrimaryContact,
            subscriptionId: s.subscriptionId,
            subscriptionStatus: s.subscriptionStatus,
        }));
    }

    async addStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const existingAssignmentIndex = this._studioAssignments.findIndex(
            (r) =>
                r.studioId === assignment.studioId &&
                r.userId === assignment.userId
        );
        if (existingAssignmentIndex < 0) {
            this._studioAssignments.push(assignment);
        }
    }

    async removeStudioAssignment(
        studioId: string,
        userId: string
    ): Promise<void> {
        this._studioAssignments = this._studioAssignments.filter(
            (s) => s.studioId !== studioId || s.userId !== userId
        );
    }

    async updateStudioAssignment(assignment: StudioAssignment): Promise<void> {
        const existingAssignmentIndex = this._studioAssignments.findIndex(
            (r) =>
                r.studioId === assignment.studioId &&
                r.userId === assignment.userId
        );
        if (existingAssignmentIndex >= 0) {
            this._studioAssignments[existingAssignmentIndex] = assignment;
        }
    }

    async listStudioAssignments(
        studioId: string,
        filters?: ListStudioAssignmentFilters
    ): Promise<ListedStudioAssignment[]> {
        const assignments = this._studioAssignments.filter((s) => {
            const matchesRole = !filters?.role || s.role === filters.role;
            const matchesPrimaryContact =
                !filters?.isPrimaryContact ||
                s.isPrimaryContact === filters.isPrimaryContact;
            const matchesUserId =
                !filters?.userId || s.userId === filters.userId;
            return (
                s.studioId === studioId &&
                matchesRole &&
                matchesPrimaryContact &&
                matchesUserId
            );
        });

        let results: ListedStudioAssignment[] = [];

        for (let s of assignments) {
            const user = await this.findUser(s.userId);
            if (!user) {
                continue;
            }
            results.push({
                studioId: s.studioId,
                userId: s.userId,
                isPrimaryContact: s.isPrimaryContact,
                role: s.role,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                },
            });
        }

        return results;
    }

    async listUserAssignments(userId: string): Promise<ListedUserAssignment[]> {
        const assignments = this._studioAssignments.filter(
            (s) => s.userId === userId
        );

        return assignments.map((s) => {
            const studio = this._studios.find(
                (studio) => studio.id === s.studioId
            );
            return {
                displayName: studio.displayName,
                studioId: s.studioId,
                userId: s.userId,
                isPrimaryContact: s.isPrimaryContact,
                role: s.role,
            };
        });
    }

    async countRecords(filter: CountRecordsFilter): Promise<number> {
        let count = 0;
        for (let record of this._records) {
            if (filter.studioId && record.studioId === filter.studioId) {
                count++;
            } else if (filter.ownerId && record.ownerId === filter.ownerId) {
                count++;
            } else {
                count++;
            }
        }

        return count;
    }

    async saveUser(user: AuthUser): Promise<void> {
        let index = this._findUserIndex(user.id);
        if (index >= 0) {
            this._users[index] = user;
        } else {
            this._users.push(user);
        }
    }

    async saveNewUser(user: AuthUser): Promise<SaveNewUserResult> {
        let index = this._users.findIndex(
            (u) =>
                (!!user.email && u.email === user.email) ||
                (!!user.phoneNumber && u.phoneNumber === user.phoneNumber)
        );
        if (index >= 0) {
            return {
                success: false,
                errorCode: 'user_already_exists',
                errorMessage: 'The user already exists.',
            };
        } else {
            this._users.push(user);
        }

        return {
            success: true,
        };
    }

    async findUser(userId: string): Promise<AuthUser> {
        const user = this._users.find((u) => u.id === userId);
        return user;
    }

    async setRevokeAllSessionsTimeForUser(
        userId: string,
        allSessionRevokeTimeMs: number
    ): Promise<void> {
        const user = await this.findUser(userId);
        if (user) {
            await this.saveUser({
                ...user,
                allSessionRevokeTimeMs: allSessionRevokeTimeMs,
            });
        }
    }

    async findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser> {
        const user = this._users.find((u) =>
            addressType === 'email'
                ? u.email === address
                : u.phoneNumber === address
        );
        return user;
    }

    async findUserByStripeCustomerId(customerId: string): Promise<AuthUser> {
        const user = this._users.find((u) => u.stripeCustomerId === customerId);
        return user;
    }

    async findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest> {
        return this._loginRequests.find(
            (lr) => lr.userId === userId && lr.requestId === requestId
        );
    }

    async findSession(userId: string, sessionId: string): Promise<AuthSession> {
        return this._sessions.find(
            (s) => s.userId === userId && s.sessionId === sessionId
        );
    }

    async saveLoginRequest(
        request: AuthLoginRequest
    ): Promise<AuthLoginRequest> {
        const index = this._loginRequests.findIndex(
            (lr) =>
                lr.userId === request.userId &&
                lr.requestId === request.requestId
        );
        if (index >= 0) {
            this._loginRequests[index] = request;
        } else {
            this._loginRequests.push(request);
        }

        return request;
    }

    async setCurrentLoginRequest(
        userId: string,
        requestId: string
    ): Promise<void> {
        const userIndex = this._users.findIndex((u) => u.id === userId);
        if (userIndex >= 0) {
            const user = this._users[userIndex];
            this._users[userIndex] = {
                ...user,
                currentLoginRequestId: requestId,
            };
        }
    }

    async markLoginRequestComplete(
        userId: string,
        requestId: string,
        completedTimeMs: number
    ): Promise<void> {
        const index = this._loginRequests.findIndex(
            (lr) => lr.userId === userId && lr.requestId === requestId
        );

        if (index >= 0) {
            this._loginRequests[index].completedTimeMs = completedTimeMs;
        } else {
            throw new Error('Request not found.');
        }
    }

    async incrementLoginRequestAttemptCount(
        userId: string,
        requestId: string
    ): Promise<void> {
        const request = this._loginRequests.find(
            (lr) => lr.userId === userId && lr.requestId === requestId
        );
        if (request) {
            request.attemptCount += 1;
        }
    }

    async saveSession(session: AuthSession): Promise<void> {
        const index = this._sessions.findIndex(
            (s) =>
                s.userId === session.userId && s.sessionId === session.sessionId
        );
        if (index >= 0) {
            this._sessions[index] = session;
        } else {
            this._sessions.push(session);
        }
    }

    async replaceSession(
        session: AuthSession,
        newSession: AuthSession,
        revokeTimeMs: number
    ): Promise<void> {
        this.saveSession({
            ...session,
            revokeTimeMs: revokeTimeMs,
            nextSessionId: newSession.sessionId,
        });
        this.saveSession({
            ...newSession,
            previousSessionId: session.sessionId,
        });
    }

    async listSessions(
        userId: string,
        expireTimeMs: number
    ): Promise<ListSessionsDataResult> {
        let orderedSessions = sortBy(
            this._sessions.filter((s) => s.userId === userId),
            (s) => -s.expireTimeMs
        );

        if (expireTimeMs) {
            orderedSessions = orderedSessions.filter(
                (s) => s.expireTimeMs < expireTimeMs
            );
        }

        return {
            success: true,
            sessions: orderedSessions.slice(0, 10),
        };
    }

    async listEmailRules(): Promise<RegexRule[]> {
        return this._emailRules.slice();
    }

    async listSmsRules(): Promise<RegexRule[]> {
        return this._smsRules.slice();
    }

    async saveSubscription(subscription: AuthSubscription): Promise<void> {
        const index = this._subscriptions.findIndex(
            (s) => s.id === subscription.id
        );
        if (index >= 0) {
            this._subscriptions[index] = subscription;
        } else {
            this._subscriptions.push(subscription);
        }
    }

    async getSubscriptionById(id: string): Promise<AuthSubscription> {
        return this._subscriptions.find((s) => s.id === id);
    }
    async getSubscriptionByStripeSubscriptionId(
        id: string
    ): Promise<AuthSubscription> {
        return this._subscriptions.find((s) => s.stripeSubscriptionId === id);
    }
    async saveSubscriptionPeriod(
        period: AuthSubscriptionPeriod
    ): Promise<void> {
        const index = this._periods.findIndex((p) => p.id === period.id);
        if (index >= 0) {
            this._periods[index] = period;
        } else {
            this._periods.push(period);
        }
    }
    async getSubscriptionPeriodById(
        id: string
    ): Promise<AuthSubscriptionPeriod> {
        return this._periods.find((p) => p.id === id);
    }
    async listSubscriptionPeriodsBySubscriptionId(
        subscriptionId: string
    ): Promise<AuthSubscriptionPeriod[]> {
        return this._periods.filter((p) => p.subscriptionId === subscriptionId);
    }

    async saveInvoice(invoice: AuthInvoice): Promise<void> {
        const index = this._invoices.findIndex((i) => i.id === invoice.id);
        if (index >= 0) {
            this._invoices[index] = invoice;
        } else {
            this._invoices.push(invoice);
        }
    }

    async getInvoiceById(id: string): Promise<AuthInvoice> {
        return this._invoices.find((i) => i.id === id);
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

    private _findUserIndex(id: string): number {
        return this._users.findIndex((u) => u.id === id);
    }

    async setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string,
        updatePolicy: UserPolicy,
        deletePolicy: UserPolicy,
        markers: string[]
    ): Promise<SetDataResult> {
        let record = this._getDataRecord(recordName);
        record.set(address, {
            data: data,
            publisherId: publisherId,
            subjectId: subjectId,
            updatePolicy,
            deletePolicy,
            markers,
        });
        return {
            success: true,
        };
    }

    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        let record = this._getDataRecord(recordName);
        let data = record.get(address);
        if (!data) {
            return {
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            };
        }

        return {
            success: true,
            data: data.data,
            publisherId: data.publisherId,
            subjectId: data.subjectId,
            updatePolicy: data.updatePolicy,
            deletePolicy: data.deletePolicy,
            markers: data.markers,
        };
    }

    async eraseData(
        recordName: string,
        address: string
    ): Promise<EraseDataStoreResult> {
        let record = this._getDataRecord(recordName);
        let deleted = record.delete(address);
        if (!deleted) {
            return {
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            };
        }

        return {
            success: true,
        };
    }

    async listData(
        recordName: string,
        address: string
    ): Promise<ListDataStoreResult> {
        let record = this._getDataRecord(recordName);
        let items = [] as ListedDataStoreItem[];

        const count = record.size;
        for (let [key, item] of record.entries()) {
            if (!address || key > address) {
                items.push({
                    address: key,
                    data: item.data,
                    markers: item.markers,
                });
            }
        }

        return {
            success: true,
            items,
            totalCount: count,
        };
    }

    private _getDataRecord(recordName: string) {
        let record = this._dataBuckets.get(recordName);
        if (!record) {
            record = new Map();
            this._dataBuckets.set(recordName, record);
        }
        return record;
    }

    async presignFileUpload(
        request: PresignFileUploadRequest
    ): Promise<PresignFileUploadResult> {
        return {
            success: true,
            uploadHeaders: {
                ...request.headers,
                'record-name': request.recordName,
                'content-type': request.fileMimeType,
            },
            uploadMethod: 'POST',
            uploadUrl: `${this._fileUploadUrl}/${request.recordName}/${request.fileName}`,
        };
    }

    async presignFileRead(
        request: PresignFileReadRequest
    ): Promise<PresignFileReadResult> {
        return {
            success: true,
            requestHeaders: {
                ...request.headers,
                'record-name': request.recordName,
            },
            requestMethod: 'GET',
            requestUrl: `${this._fileUploadUrl}/${request.recordName}/${request.fileName}`,
        };
    }

    async getFileNameFromUrl(
        fileUrl: string
    ): Promise<GetFileNameFromUrlResult> {
        if (fileUrl.startsWith(this._fileUploadUrl)) {
            let recordNameAndFileName = fileUrl.slice(
                this._fileUploadUrl.length + 1
            );
            let nextSlash = recordNameAndFileName.indexOf('/');
            if (nextSlash < 0) {
                return {
                    success: false,
                    errorCode: 'unacceptable_url',
                    errorMessage: 'The URL does not match an expected format.',
                };
            }
            let recordName = recordNameAndFileName.slice(0, nextSlash);
            let fileName = recordNameAndFileName.slice(nextSlash + 1);

            if (recordName && fileName) {
                return {
                    success: true,
                    recordName,
                    fileName,
                };
            }
            return {
                success: false,
                errorCode: 'unacceptable_url',
                errorMessage: 'The URL does not match an expected format.',
            };
        }

        return {
            success: false,
            errorCode: 'unacceptable_url',
            errorMessage: 'The URL does not match an expected format.',
        };
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult> {
        let file = this._files.get(fileName);

        if (file) {
            return {
                success: true,
                fileName: file.fileName,
                recordName: file.recordName,
                publisherId: file.publisherId,
                subjectId: file.subjectId,
                sizeInBytes: file.sizeInBytes,
                uploaded: file.uploaded,
                description: file.description,
                url: `${this._fileUploadUrl}/${file.recordName}/${file.fileName}`,
                markers: file.markers,
            };
        } else {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }
    }

    async listUploadedFiles(
        recordName: string,
        fileName: string
    ): Promise<ListFilesStoreResult> {
        let files = sortBy(
            [...this._files.values()].filter(
                (f) => f.recordName === recordName && f.uploaded
            ),
            (f) => f.fileName
        );

        const count = files.length;

        if (fileName) {
            files = files.filter((f) => f.fileName > fileName);
        }

        return {
            success: true,
            files: files.slice(0, 10).map((f) => ({
                fileName: f.fileName,
                uploaded: f.uploaded,
                markers: f.markers,
                description: f.description,
                sizeInBytes: f.sizeInBytes,
                url: `${this._fileUploadUrl}/${f.recordName}/${f.fileName}`,
            })),
            totalCount: count,
        };
    }

    async addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string,
        markers: string[]
    ): Promise<AddFileResult> {
        if (this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists in the store.',
            };
        }

        let file: StoredFile = {
            fileName: fileName,
            recordName: recordName,
            publisherId,
            subjectId,
            sizeInBytes,
            description,
            markers,
            uploaded: false,
        };

        this._files.set(fileName, file);

        return {
            success: true,
        };
    }

    async updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult> {
        if (!this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        let file = this._files.get(fileName);

        this._files.set(fileName, {
            ...file,
            markers: markers.slice(),
        });

        return {
            success: true,
        };
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        let file = this._files.get(fileName);

        if (!file) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        file.uploaded = true;
        return {
            success: true,
        };
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        const deleted = this._files.delete(fileName);
        if (!deleted) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        return {
            success: true,
        };
    }

    getAllowedUploadHeaders(): string[] {
        return ['record-name', 'content-type'];
    }

    async addEventCount(
        recordName: string,
        eventName: string,
        count: number
    ): Promise<AddEventCountStoreResult> {
        const record = this._getEventRecord(recordName);

        if (record.has(eventName)) {
            let data = record.get(eventName);
            data.count += count;
        } else {
            record.set(eventName, {
                count: count,
            });
        }

        return {
            success: true,
        };
    }

    async getEventCount(
        recordName: string,
        eventName: string
    ): Promise<GetEventCountStoreResult> {
        const record = this._getEventRecord(recordName);

        const e = record.has(eventName)
            ? record.get(eventName)
            : {
                  count: 0,
              };

        return {
            success: true,
            count: e.count,
            markers: e.markers,
        };
    }

    async updateEvent(
        recordName: string,
        eventName: string,
        updates: EventRecordUpdate
    ): Promise<UpdateEventResult> {
        const record = this._getEventRecord(recordName);

        const e = record.has(eventName)
            ? record.get(eventName)
            : {
                  count: 0,
              };

        record.set(eventName, {
            ...e,
            ...updates,
        });

        return {
            success: true,
        };
    }

    async listEvents(
        recordName: string,
        eventName: string
    ): Promise<ListEventsStoreResult> {
        const record = this._getEventRecord(recordName);
        const totalCount = record.size;
        let events = sortBy([...record.entries()], ([name, data]) => name);

        if (eventName) {
            events = events.filter(([name, data]) => name > eventName);
        }

        return {
            success: true,
            events: events.slice(0, 10).map(([name, data]) => ({
                eventName: name,
                count: data.count,
                markers: data.markers,
            })),
            totalCount,
        };
    }

    private _getEventRecord(recordName: string) {
        let record = this._eventBuckets.get(recordName);
        if (!record) {
            record = new Map();
            this._eventBuckets.set(recordName, record);
        }
        return record;
    }

    async listUserPolicies(
        recordName: string,
        startingMarker: string
    ): Promise<ListUserPoliciesStoreResult> {
        const recordPolicies = this.policies[recordName] ?? {};

        const keys = sortBy(Object.keys(recordPolicies));

        let results: ListedUserPolicy[] = [];
        let start = !startingMarker;
        for (let key of keys) {
            if (start) {
                results.push({
                    marker: key,
                    document: recordPolicies[key].document,
                    markers: recordPolicies[key].markers,
                });
            } else if (key === startingMarker || key > startingMarker) {
                start = true;
            }
        }

        return {
            success: true,
            policies: results,
            totalCount: results.length,
        };
    }

    async getUserPolicy(
        recordName: string,
        marker: string
    ): Promise<GetUserPolicyResult> {
        const policy = this.policies[recordName]?.[marker];

        if (!policy) {
            return {
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: 'The policy was not found.',
            };
        }

        return {
            success: true,
            document: policy.document,
            markers: policy.markers,
        };
    }

    async updateUserPolicy(
        recordName: string,
        marker: string,
        policy: UserPolicyRecord
    ): Promise<UpdateUserPolicyResult> {
        if (!this.policies[recordName]) {
            this.policies[recordName] = {};
        }

        this.policies[recordName][marker] = {
            document: policy.document,
            markers: policy.markers,
        };

        return {
            success: true,
        };
    }

    async listPoliciesForMarker(
        recordName: string,
        marker: string
    ): Promise<PolicyDocument[]> {
        const policies = [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT];
        if (marker === PUBLIC_READ_MARKER) {
            policies.push(DEFAULT_PUBLIC_READ_POLICY_DOCUMENT);
        }
        const policy = this.policies[recordName]?.[marker];
        if (policy) {
            policies.push(policy.document);
        }
        return policies;
    }

    async listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<AssignedRole[]> {
        return this._getRolesForEntity(recordName, userId);
    }

    async listRolesForInst(
        recordName: string,
        inst: string
    ): Promise<AssignedRole[]> {
        return this._getRolesForEntity(recordName, inst);
    }

    async listAssignmentsForRole(
        recordName: string,
        role: string
    ): Promise<ListedRoleAssignments> {
        let record = this.roles[recordName];
        let assignedRoles = this.roleAssignments[recordName];

        let assignments: RoleAssignment[] = [];

        for (let id in record) {
            if (record[id].has(role)) {
                assignments.push({
                    type: 'user',
                    userId: id,
                    role: {
                        role,
                        expireTimeMs: null,
                    },
                });
            }
        }

        for (let id in assignedRoles) {
            let roles = assignedRoles[id];
            let assignment = roles.find((r) => r.role === role);
            if (assignment) {
                assignments.push({
                    type: 'user',
                    userId: id,
                    role: assignment,
                });
            }
        }

        return {
            assignments,
            totalCount: assignments.length,
        };
    }

    async listAssignments(
        recordName: string,
        startingRole: string
    ): Promise<ListedRoleAssignments> {
        let record = this.roles[recordName];
        let assignedRoles = this.roleAssignments[recordName];

        let totalCount: number = 0;
        let assignments: RoleAssignment[] = [];

        for (let id in record) {
            const roles = record[id];
            for (let role of roles) {
                assignments.push({
                    type: 'user',
                    userId: id,
                    role: {
                        role,
                        expireTimeMs: null,
                    },
                });
                totalCount += 1;
            }
        }

        for (let id in assignedRoles) {
            let roles = assignedRoles[id];
            for (let role of roles) {
                assignments.push({
                    type: 'user',
                    userId: id,
                    role,
                });
                totalCount += 1;
            }
        }

        assignments = sortBy(
            assignments,
            (a) => a.role.role,
            (a) => (a as any).userId ?? (a as any).inst
        );

        if (startingRole) {
            assignments = assignments.filter((a) => a.role.role > startingRole);
        }

        return {
            assignments: assignments.slice(0, 10),
            totalCount: totalCount,
        };
    }

    async assignSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: AssignedRole
    ): Promise<UpdateUserRolesResult> {
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }

        const roles = this.roleAssignments[recordName][subjectId] ?? [];

        const filtered = roles.filter(
            (r) =>
                r.role !== role.role ||
                getExpireTime(r.expireTimeMs) <= role.expireTimeMs
        );

        this.roleAssignments[recordName][subjectId] = [
            ...filtered,
            {
                role: role.role,
                expireTimeMs:
                    role.expireTimeMs === Infinity ? null : role.expireTimeMs,
            },
        ];

        return {
            success: true,
        };
    }

    async revokeSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: string
    ): Promise<UpdateUserRolesResult> {
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }

        const roles = this.roleAssignments[recordName][subjectId] ?? [];

        const filtered = roles.filter((r) => r.role !== role);

        this.roleAssignments[recordName][subjectId] = filtered;

        return {
            success: true,
        };
    }

    async updateUserRoles(
        recordName: string,
        userId: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }

        const assignments = update.roles
            .filter((r) => getExpireTime(r.expireTimeMs) > Date.now())
            .map((r) => ({
                ...r,
                expireTimeMs:
                    r.expireTimeMs === Infinity ? null : r.expireTimeMs,
            }));
        this.roleAssignments[recordName][userId] = assignments;

        return {
            success: true,
        };
    }

    async updateInstRoles(
        recordName: string,
        inst: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }
        const assignments = update.roles
            .filter((r) => getExpireTime(r.expireTimeMs) > Date.now())
            .map((r) => ({
                ...r,
                expireTimeMs:
                    r.expireTimeMs === Infinity ? null : r.expireTimeMs,
            }));
        this.roleAssignments[recordName][inst] = assignments;

        return {
            success: true,
        };
    }

    private _getRolesForEntity(recordName: string, id: string): AssignedRole[] {
        const roles = this.roles[recordName]?.[id] ?? new Set<string>();
        const assignments = this.roleAssignments[recordName]?.[id] ?? [];

        return [
            ...[...roles].map(
                (r) =>
                    ({
                        role: r,
                        expireTimeMs: null,
                    } as AssignedRole)
            ),
            ...assignments.filter(
                (a) => getExpireTime(a.expireTimeMs) > Date.now()
            ),
        ];
    }

    async getSubscriptionDataMetricsByRecordName(
        recordName: string
    ): Promise<DataSubscriptionMetrics> {
        const info = await this._getSubscriptionInfo(recordName);
        const records = await this._listRecordsForSubscription(recordName);

        let totalItems = 0;

        for (let record of records) {
            let bucket = this._dataBuckets.get(record.name);
            if (!bucket) {
                continue;
            }
            totalItems += bucket.size;
        }

        return {
            ...info,
            totalItems,
        };
    }

    async getSubscriptionFileMetricsByRecordName(
        recordName: string
    ): Promise<FileSubscriptionMetrics> {
        const info = await this._getSubscriptionInfo(recordName);
        const records = await this._listRecordsForSubscription(recordName);

        let totalFiles = 0;
        let totalBytesStored = 0;
        let totalBytesReserved = 0;
        for (let record of records) {
            let files = [...this.files.values()].filter(
                (f) => f.recordName === record.name
            );

            for (let file of files) {
                totalFiles++;
                totalBytesReserved += file.sizeInBytes;
                if (file.uploaded) {
                    totalBytesStored += file.sizeInBytes;
                }
            }
        }

        return {
            ...info,
            totalFiles,
            totalFileBytesReserved: totalBytesReserved,
        };
    }

    async getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics> {
        const info = await this._getSubscriptionInfo(recordName);
        const records = await this._listRecordsForSubscription(recordName);

        let totalEventNames = 0;
        for (let record of records) {
            let bucket = this._eventBuckets.get(record.name);
            if (!bucket) {
                continue;
            }
            totalEventNames += bucket.size;
        }

        return {
            ...info,
            totalEventNames,
        };
    }

    async getSubscriptionRecordMetrics(
        filter: SubscriptionFilter
    ): Promise<RecordSubscriptionMetrics> {
        const metrics = await this._getSubscriptionMetrics(filter);
        const totalRecords = await this.countRecords(filter);

        return {
            ...metrics,
            totalRecords,
        };
    }

    async getSubscriptionAiChatMetrics(
        filter: SubscriptionFilter
    ): Promise<AIChatSubscriptionMetrics> {
        const info = await this._getSubscriptionMetrics(filter);
        const metrics = filter.ownerId
            ? this._aiChatMetrics.filter(
                  (m) =>
                      m.userId === filter.ownerId &&
                      (!info.currentPeriodStartMs ||
                          (m.createdAtMs >= info.currentPeriodStartMs &&
                              m.createdAtMs < info.currentPeriodEndMs))
              )
            : this._aiChatMetrics.filter(
                  (m) =>
                      m.studioId === filter.studioId &&
                      (!info.currentPeriodStartMs ||
                          (m.createdAtMs >= info.currentPeriodStartMs &&
                              m.createdAtMs < info.currentPeriodEndMs))
              );

        let totalTokens = 0;
        for (let m of metrics) {
            totalTokens += m.tokens;
        }

        return {
            ...info,
            totalTokensInCurrentPeriod: totalTokens,
        };
    }

    async recordChatMetrics(metrics: AIChatMetrics): Promise<void> {
        this._aiChatMetrics.push(metrics);
    }

    async getSubscriptionAiImageMetrics(
        filter: SubscriptionFilter
    ): Promise<AIImageSubscriptionMetrics> {
        const info = await this._getSubscriptionMetrics(filter);
        const metrics = filter.ownerId
            ? this._aiImageMetrics.filter(
                  (m) =>
                      m.userId === filter.ownerId &&
                      (!info.currentPeriodStartMs ||
                          (m.createdAtMs >= info.currentPeriodStartMs &&
                              m.createdAtMs < info.currentPeriodEndMs))
              )
            : this._aiImageMetrics.filter(
                  (m) =>
                      m.studioId === filter.studioId &&
                      (!info.currentPeriodStartMs ||
                          (m.createdAtMs >= info.currentPeriodStartMs &&
                              m.createdAtMs < info.currentPeriodEndMs))
              );

        let totalPixels = 0;
        for (let m of metrics) {
            totalPixels += m.squarePixels;
        }

        return {
            ...info,
            totalSquarePixelsInCurrentPeriod: totalPixels,
        };
    }

    async recordImageMetrics(metrics: AIImageMetrics): Promise<void> {
        this._aiImageMetrics.push(metrics);
    }

    async getSubscriptionAiSkyboxMetrics(
        filter: SubscriptionFilter
    ): Promise<AISkyboxSubscriptionMetrics> {
        const info = await this._getSubscriptionMetrics(filter);
        const metrics = filter.ownerId
            ? this._aiSkyboxMetrics.filter(
                  (m) =>
                      m.userId === filter.ownerId &&
                      (!info.currentPeriodStartMs ||
                          (m.createdAtMs >= info.currentPeriodStartMs &&
                              m.createdAtMs < info.currentPeriodEndMs))
              )
            : this._aiSkyboxMetrics.filter(
                  (m) =>
                      m.studioId === filter.studioId &&
                      (!info.currentPeriodStartMs ||
                          (m.createdAtMs >= info.currentPeriodStartMs &&
                              m.createdAtMs < info.currentPeriodEndMs))
              );

        let totalSkyboxes = 0;
        for (let m of metrics) {
            totalSkyboxes += m.skyboxes;
        }

        return {
            ...info,
            totalSkyboxesInCurrentPeriod: totalSkyboxes,
        };
    }

    async recordSkyboxMetrics(metrics: AISkyboxMetrics): Promise<void> {
        this._aiSkyboxMetrics.push(metrics);
    }

    private async _getSubscriptionInfo(
        recordName: string
    ): Promise<SubscriptionMetrics> {
        const record = await this.getRecordByName(recordName);

        const metrics = await this._getSubscriptionMetrics(record);
        return {
            ...metrics,
            recordName: record.name,
        };
    }

    private async _getSubscriptionMetrics(filter: SubscriptionFilter) {
        const config = await this.getSubscriptionConfiguration();

        let currentPeriodStart: number = null;
        let currentPeriodEnd: number = null;

        if (config?.defaultFeatures?.defaultPeriodLength) {
            const now = DateTime.utc();
            const periodStart = now.minus(
                config.defaultFeatures.defaultPeriodLength
            );

            currentPeriodStart = periodStart.toMillis();
            currentPeriodEnd = now.toMillis();
        }

        let metrics: SubscriptionMetrics = {
            ownerId: filter.ownerId,
            studioId: filter.studioId,
            subscriptionId: null,
            subscriptionStatus: null,
            currentPeriodStartMs: currentPeriodStart,
            currentPeriodEndMs: currentPeriodEnd,
        };

        if (filter.ownerId) {
            const user = await this.findUser(filter.ownerId);

            if (user) {
                metrics.subscriptionStatus = user.subscriptionStatus;
                metrics.subscriptionId = user.subscriptionId;
                metrics.currentPeriodEndMs = user.subscriptionPeriodEndMs;
                metrics.currentPeriodStartMs = user.subscriptionPeriodStartMs;
            }
        } else if (filter.studioId) {
            const studio = await this.getStudioById(filter.studioId);

            if (studio) {
                metrics.subscriptionId = studio.subscriptionId;
                metrics.subscriptionStatus = studio.subscriptionStatus;
                metrics.currentPeriodEndMs = studio.subscriptionPeriodEndMs;
                metrics.currentPeriodStartMs = studio.subscriptionPeriodStartMs;
            }
        }

        return metrics;
    }

    private async _listRecordsForSubscription(recordName: string) {
        const record = await this.getRecordByName(recordName);

        if (record.ownerId) {
            return this.listRecordsByOwnerId(record.ownerId);
        } else {
            return this.listRecordsByStudioId(record.studioId);
        }
    }

    async getInstByName(recordName: string, inst: string): Promise<InstRecord> {
        const i = await this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        return {
            recordName: i.recordName,
            inst: i.inst,
            markers: i.markers,
        };
    }

    async getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst> {
        let i = await this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return null;
        }

        return {
            recordName: b.recordName,
            inst: b.inst,
            branch: b.branch,
            temporary: b.temporary,
            linkedInst: {
                recordName: i.recordName,
                inst: i.inst,
                markers: i.markers,
            },
        };
    }

    async saveInst(inst: InstWithBranches): Promise<SaveInstResult> {
        const r = await this._getInstRecord(inst.recordName);

        if (!r) {
            return {
                success: false,
                errorCode: 'record_not_found',
                errorMessage: 'The record was not found',
            };
        }

        let i = await this._getInst(inst.recordName, inst.inst);

        const { branches, ...rest } = inst;

        let update: InstWithUpdates = {
            branches: null,
            ...(i ?? {
                instSizeInBytes: 0,
            }),
            ...rest,
        };

        if (branches) {
            update.branches = branches.map((b) => {
                return {
                    recordName: inst.recordName,
                    inst: inst.inst,
                    branch: b.branch,
                    temporary: b.temporary,
                    updates: {
                        updates: [],
                        timestamps: [],
                    },
                    archived: {
                        updates: [],
                        timestamps: [],
                    },
                };
            });
        } else if (!update.branches) {
            update.branches = [];
        }

        r.set(inst.inst, update);

        return {
            success: true,
        };
    }

    async saveBranch(branch: BranchRecord): Promise<SaveBranchResult> {
        let i = await this._getInst(branch.recordName, branch.inst);

        if (!i) {
            return {
                success: false,
                errorCode: 'inst_not_found',
                errorMessage: 'The inst was not found.',
            };
        }

        const b = i.branches.find((b) => b.branch === branch.branch);

        if (!b) {
            i.branches.push({
                ...branch,
                updates: {
                    updates: [],
                    timestamps: [],
                },
                archived: {
                    updates: [],
                    timestamps: [],
                },
            });
            return {
                success: true,
            };
        }

        b.temporary = branch.temporary;

        return {
            success: true,
        };
    }

    async getAllUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates> {
        const i = await this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return null;
        }

        return {
            updates: b.archived.updates.slice(),
            timestamps: b.archived.timestamps.slice(),
            instSizeInBytes: i.instSizeInBytes,
        };
    }

    async getCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates> {
        const i = await this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return null;
        }

        return {
            updates: b.updates.updates.slice(),
            timestamps: b.updates.timestamps.slice(),
            instSizeInBytes: i.instSizeInBytes,
        };
    }

    async getInstSize(recordName: string, inst: string): Promise<number> {
        const i = await this._getInst(recordName, inst);

        if (!i) {
            return null;
        }

        return i.instSizeInBytes;
    }

    async countUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const i = await this._getInst(recordName, inst);

        if (!i) {
            return 0;
        }

        const b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            return 0;
        }

        return b.updates.updates.length;
    }

    async addUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<AddUpdatesResult> {
        const r = this._instRecords.get(recordName);

        if (!r) {
            return {
                success: false,
                errorCode: 'record_not_found',
                branch,
            };
        }

        const i = await this._getInst(recordName, inst);

        if (!i) {
            return {
                success: false,
                errorCode: 'inst_not_found',
                branch,
            };
        }

        let b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            b = {
                branch,
                inst: i.inst,
                recordName: i.recordName,
                temporary: false,
                updates: {
                    updates: [],
                    timestamps: [],
                },
                archived: {
                    updates: [],
                    timestamps: [],
                },
            };
            i.branches.push(b);
        }

        let storedUpdates = b.updates;

        const newSize = i.instSizeInBytes + sizeInBytes;

        if (newSize > this.maxAllowedInstSize) {
            return {
                success: false,
                errorCode: 'max_size_reached',
                branch,
                maxInstSizeInBytes: this.maxAllowedInstSize,
                neededInstSizeInBytes: newSize,
            };
        }
        i.instSizeInBytes = newSize;

        storedUpdates.updates.push(...updates);
        storedUpdates.timestamps.push(Date.now());

        const archivedUpdates = b.archived;
        archivedUpdates.updates.push(...updates);
        archivedUpdates.timestamps.push(Date.now());

        return {
            success: true,
        };
    }

    async replaceCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updateToAdd: string,
        sizeInBytes: number
    ): Promise<ReplaceUpdatesResult> {
        const r = this._instRecords.get(recordName);

        if (!r) {
            return {
                success: false,
                errorCode: 'record_not_found',
                branch,
            };
        }

        const i = await this._getInst(recordName, inst);

        if (!i) {
            return {
                success: false,
                errorCode: 'inst_not_found',
                branch,
            };
        }

        let b = i.branches.find((b) => b.branch === branch);

        if (!b) {
            b = {
                branch,
                inst: i.inst,
                recordName: i.recordName,
                temporary: false,
                updates: {
                    updates: [],
                    timestamps: [],
                },
                archived: {
                    updates: [],
                    timestamps: [],
                },
            };
            i.branches.push(b);
        }

        const storedUpdates = b.updates;
        storedUpdates.updates = [];
        storedUpdates.timestamps = [];

        return this.addUpdates(
            recordName,
            inst,
            branch,
            [updateToAdd],
            sizeInBytes
        );
    }

    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const r = this._instRecords.get(recordName);

        if (!r) {
            return;
        }

        const i = await this._getInst(recordName, inst);

        if (!i) {
            return;
        }

        const index = i.branches.findIndex((b) => b.branch === branch);
        if (index >= 0) {
            const b = i.branches[index];
            for (let update of b.updates.updates) {
                i.instSizeInBytes -= update.length;
            }
            i.branches.splice(index, 1);
        }
    }

    // reset() {
    //     this._instRecords = new Map();
    //     this.maxAllowedInstSize = Infinity;
    // }

    private async _getInst(
        recordName: string,
        inst: string
    ): Promise<InstWithUpdates | null> {
        let record = await this._getInstRecord(recordName);
        return record?.get(inst);
    }

    private async _getInstRecord(
        recordName: string
    ): Promise<Map<string, InstWithUpdates>> {
        let record = this._instRecords.get(recordName);
        if (!record) {
            const r = await this.getRecordByName(recordName);
            if (r) {
                record = new Map();
                this._instRecords.set(recordName, record);
            }
        }
        return record;
    }
}

interface RecordData {
    data: any;
    publisherId: string;
    subjectId: string;
    updatePolicy: UserPolicy;
    deletePolicy: UserPolicy;
    markers: string[];
}

interface EventData {
    count: number;
    markers?: string[];
}

interface StoredFile {
    fileName: string;
    recordName: string;
    publisherId: string;
    subjectId: string;
    sizeInBytes: number;
    uploaded: boolean;
    description: string;
    markers: string[];
}

export interface InstWithUpdates extends InstRecord {
    instSizeInBytes: number;
    branches: BranchWithUpdates[];
}

export interface BranchWithUpdates extends BranchRecord {
    updates: StoredUpdates;
    archived: StoredUpdates;
}
