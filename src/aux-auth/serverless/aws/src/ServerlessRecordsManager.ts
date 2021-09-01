import {
    formatAuthToken,
    parseAuthToken,
    RecordReference,
    RecordSpace,
} from '@casual-simulation/aux-common';
import { AuthProvider } from './AuthProvider';
import {
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
        const [token, bundle] = parseAuthToken(request.token);

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
}
