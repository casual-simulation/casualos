import {
    formatAuthToken,
    GetRecordsActionResult,
    hasValue,
    parseAuthToken,
    RecordReference,
    RecordSpace,
} from '@casual-simulation/aux-common';
import { AuthProvider } from './AuthProvider';
import {
    RecordsQuery,
    RecordsStore,
    SaveRecordResult,
    ServerlessRecord,
} from './RecordsStore';

export interface ServerlessPublishableRecord {
    token: string;
    address: string;
    space: RecordSpace;
    record: any;
}

export interface PublishResult {
    status: number;
    message?: string;
    data?: {
        issuer: string;
        address: string;
        space: string;
    };
}

export interface GetRecordsResult {
    status: number;
    message?: string;
    data?: GetRecordsActionResult;
}

export interface DeleteRecordResult {
    status: number;
    message?: string;
}

export interface ServerlessGetRecordsRequest {
    token?: string;
    issuer: string;
    address?: string;
    prefix?: string;
    cursor?: string;
    space: RecordSpace;
}

export interface ServerlessDeleteRecordRequest {
    token: string;
    issuer: string;
    address: string;
    space: RecordSpace;
}

const _24_HOURS_IN_MILISECONDS = 1000 * 60 * 60 * 24;

export class ServerlessRecordsManager {
    private _auth: AuthProvider;
    private _store: RecordsStore;

    constructor(auth: AuthProvider, store: RecordsStore) {
        this._auth = auth;
        this._store = store;
    }

    async publishRecord(
        request: ServerlessPublishableRecord
    ): Promise<PublishResult> {
        if (!request.token) {
            return {
                status: 400,
                message: 'Invalid request. A auth token must be provided.',
            };
        }
        const tokenResult = parseAuthToken(request.token);

        if (!tokenResult) {
            return {
                status: 403,
                message: 'Invalid token.',
            };
        }

        const [token, bundle] = tokenResult;

        const issuer = this._auth.validateToken(token, bundle);

        if (!issuer) {
            return {
                status: 403,
                message: 'Invalid token.',
            };
        }

        let appRecord: ServerlessRecord = {
            issuer,
            address: request.address,
            record: request.record,
            creationDate: Date.now(),
            visibility: request.space.endsWith('Restricted')
                ? 'restricted'
                : 'global',
            authorizedUsers: [formatAuthToken(issuer, bundle)],
        };
        let result: SaveRecordResult;

        if (
            request.space === 'permanentGlobal' ||
            request.space === 'permanentRestricted'
        ) {
            result = await this._store.savePermanentRecord(appRecord);
        } else if (
            request.space === 'tempGlobal' ||
            request.space === 'tempRestricted'
        ) {
            result = await this._store.saveTemporaryRecord(appRecord);
        }

        if (!result) {
            return {
                status: 200,
                data: {
                    issuer: issuer,
                    address: request.address,
                    space: request.space,
                },
            };
        } else if (result === 'already_exists') {
            return {
                status: 409,
                message: 'Record already exists.',
            };
        } else {
            return {
                status: 500,
                message: 'A server error occurred.',
            };
        }
    }

    async getRecords(
        request: ServerlessGetRecordsRequest
    ): Promise<GetRecordsResult> {
        let tokenResult = this._parseToken(request.token);

        let tokenIssuer: string;
        let bundle: string;
        if (tokenResult === null) {
            return {
                status: 403,
                message: 'Invalid token.',
            };
        } else if (!!tokenResult) {
            tokenIssuer = tokenResult[0];
            bundle = tokenResult[1];
        }

        const authToken =
            hasValue(tokenIssuer) && hasValue(bundle)
                ? formatAuthToken(tokenIssuer, bundle)
                : undefined;

        if (
            !hasValue(request.issuer) ||
            !hasValue(request.space) ||
            (!hasValue(request.address) &&
                !hasValue(request.prefix) &&
                !hasValue(request.cursor))
        ) {
            return {
                status: 400,
                message: 'Invalid request.',
            };
        }

        const visibility =
            request.space === 'permanentGlobal' ||
            request.space === 'tempGlobal'
                ? 'global'
                : 'restricted';

        if (visibility === 'restricted' && !hasValue(authToken)) {
            return {
                status: 401,
                message:
                    'An auth token must be provided when requesting records from a restricted space.',
            };
        }

        let query: RecordsQuery = {
            issuer: request.issuer,
            visibility,
        };

        if (hasValue(request.cursor)) {
            query.cursor = request.cursor;
        } else if (hasValue(request.address)) {
            query.address = request.address;
        } else if (hasValue(request.prefix)) {
            query.prefix = request.prefix;
        }

        if (visibility === 'restricted' && hasValue(authToken)) {
            query.token = authToken;
        }

        let result: GetRecordsActionResult;

        if (
            request.space === 'permanentGlobal' ||
            request.space === 'permanentRestricted'
        ) {
            result = await this._store.getPermanentRecords(query);
        } else if (
            request.space === 'tempGlobal' ||
            request.space === 'tempRestricted'
        ) {
            result = await this._store.getTemporaryRecords(query);
        }

        if (result) {
            return {
                status: 200,
                data: result,
            };
        }

        console.error(
            '[ServerlessRecordsManager] Did not handle request for space: ' +
                request.space
        );
        return {
            status: 500,
            message: 'A server error occurred.',
        };
    }

    async deleteRecord(
        request: ServerlessDeleteRecordRequest
    ): Promise<DeleteRecordResult> {
        if (!hasValue(request.token)) {
            return {
                status: 400,
                message: 'Invalid request. A auth token must be provided.',
            };
        }

        const tokenResult = this._parseToken(request.token);

        if (!tokenResult) {
            return {
                status: 403,
                message: 'Invalid token.',
            };
        }

        const [issuer, bundle, expireTime] = tokenResult;

        if (expireTime - _24_HOURS_IN_MILISECONDS > Date.now()) {
            return {
                status: 403,
                message: 'Permanent auth tokens cannot delete records.',
            };
        }

        if (
            !hasValue(issuer) ||
            !hasValue(bundle) ||
            !hasValue(request.space) ||
            !hasValue(request.address)
        ) {
            return {
                status: 400,
                message: 'Invalid request.',
            };
        }

        let deleted: boolean;
        if (
            request.space === 'permanentGlobal' ||
            request.space === 'permanentRestricted'
        ) {
            await this._store.deletePermanentRecord({
                issuer,
                address: request.address,
            });
            deleted = true;
        } else if (
            request.space === 'tempGlobal' ||
            request.space === 'tempRestricted'
        ) {
            await this._store.deleteTemporaryRecord({
                issuer,
                address: request.address,
            });
            deleted = true;
        }

        if (deleted) {
            return {
                status: 200,
            };
        }

        console.error(
            '[ServerlessRecordsManager] Did not handle request for space: ' +
                request.space
        );
        return {
            status: 500,
            message: 'A server error occurred.',
        };
    }

    private _parseToken(requestToken: string) {
        if (hasValue(requestToken)) {
            const tokenResult = parseAuthToken(requestToken);

            if (!tokenResult) {
                return null;
            }

            const [token, b] = tokenResult;

            const issuer = this._auth.validateToken(token, b);

            if (!issuer) {
                return null;
            }

            const expireTime = this._auth.getTokenExpireTime(token);

            return [issuer, b, expireTime] as const;
        }

        return undefined;
    }
}
