import { sortBy } from 'lodash';
import { RegexRule } from './Utils';
import {
    AddressType,
    AuthLoginRequest,
    AuthSession,
    AuthStore,
    AuthUser,
    ListSessionsDataResult,
    SaveNewUserResult,
} from './AuthStore';

export class MemoryAuthStore implements AuthStore {
    private _users: AuthUser[] = [];
    private _loginRequests: AuthLoginRequest[] = [];
    private _sessions: AuthSession[] = [];

    private _emailRules: RegexRule[] = [];
    private _smsRules: RegexRule[] = [];

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

    private _findUserIndex(id: string): number {
        return this._users.findIndex((u) => u.id === id);
    }
}
