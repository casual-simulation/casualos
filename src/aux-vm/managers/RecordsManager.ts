import {
    BotAction,
    PublishRecordAction,
    hasValue,
    asyncResult,
    asyncError,
    GetRecordsAction,
    DeleteRecordAction,
    RecordDataAction,
    GetRecordDataAction,
} from '@casual-simulation/aux-common';
import { AuxConfigParameters } from '../vm/AuxConfig';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { AuthHelperInterface } from './AuthHelperInterface';
import { BotHelper } from './BotHelper';
import {
    GetDataResult,
    RecordDataResult,
} from '@casual-simulation/aux-records';

/**
 * Defines a class that provides capabilities for storing and retrieving records.
 */
export class RecordsManager {
    private _config: AuxConfigParameters;
    private _helper: BotHelper;
    private _auth: AuthHelperInterface;

    constructor(
        config: AuxConfigParameters,
        helper: BotHelper,
        auth: AuthHelperInterface
    ) {
        this._config = config;
        this._helper = helper;
        this._auth = auth;
    }

    handleEvents(events: BotAction[]): void {
        for (let event of events) {
            if (event.type === 'record_data') {
                this._recordData(event);
            } else if (event.type === 'get_record_data') {
                this._getRecordData(event);
            }
        }
    }

    private async _recordData(event: RecordDataAction) {
        try {
            console.log('[RecordHelper] Recording data...', event);
            const token = await this._getAuthToken();

            if (!token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        } as RecordDataResult)
                    );
                }
                return;
            }

            const result: AxiosResponse<RecordDataResult> = await axios.post(
                this._publishUrl('/api/v2/records/data'),
                {
                    recordKey: event.recordKey,
                    address: event.address,
                    data: event.data,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (result.data.success) {
                console.log('[RecordHelper] Data recorded!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordHelper] Error publishing record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _getRecordData(event: GetRecordDataAction) {
        try {
            if (hasValue(event.taskId)) {
                const result: AxiosResponse<GetDataResult> = await axios.get(
                    this._publishUrl('/api/v2/records/data', {
                        recordName: event.recordName,
                        address: event.address,
                    })
                );

                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordHelper] Error getting record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _getAuthToken(): Promise<string> {
        if (!(await this._auth.isAuthenticated())) {
            await this._auth.authenticate();
        }
        return this._auth.getAuthToken();
    }

    private _publishUrl(path: string, queryParams: any = {}): string {
        let url = new URL(path, this._config.recordsOrigin);

        for (let key in queryParams) {
            url.searchParams.set(key, queryParams[key]);
        }

        return url.href;
    }
}
