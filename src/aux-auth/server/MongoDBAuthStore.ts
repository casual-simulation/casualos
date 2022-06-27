import {
    AddressType,
    AuthLoginRequest,
    AuthSession,
    AuthStore,
    AuthUser,
    SaveNewUserResult,
} from '@casual-simulation/aux-records/AuthStore';
import { Collection } from 'mongodb';

export class MongoDBAuthStore implements AuthStore {
    private _users: Collection<MongoDBAuthUser>;
    private _loginRequests: Collection<MongoDBLoginRequest>;
    private _sessions: Collection<MongoDBAuthSession>;

    constructor(
        users: Collection<MongoDBAuthUser>,
        loginRequests: Collection<MongoDBLoginRequest>,
        sessions: Collection<MongoDBAuthSession>
    ) {
        this._users = users;
        this._loginRequests = loginRequests;
        this._sessions = sessions;
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
                    ipAddress: session.ipAddress,
                },
            },
            {
                upsert: true,
            }
        );
    }
}

export interface MongoDBAuthUser {
    _id: string;
    name: string;
    email: string;
    phoneNumber: string;
    avatarPortraitUrl: string;
    avatarUrl: string;
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
     * The IP Address that the session was granted to.
     */
    ipAddress: string;
}
