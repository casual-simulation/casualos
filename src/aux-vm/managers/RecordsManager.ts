import {
    BotAction,
    PublishRecordAction,
    hasValue,
    asyncResult,
    asyncError,
    GetRecordsAction,
    DeleteRecordAction,
    RecordDataAction,
} from '@casual-simulation/aux-common';
import { AuxConfigParameters } from '../vm/AuxConfig';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { AuthHelperInterface } from './AuthHelperInterface';
import { BotHelper } from './BotHelper';
import { RecordDataResult } from '@casual-simulation/aux-records';

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
            }
        }
    }

    private async _recordData(event: RecordDataAction) {
        try {
            console.log('[RecordHelper] Recording data...', event);
            const token = await this._auth.getAuthToken();
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

    private _publishUrl(path: string): string {
        return new URL(path, this._config.recordsOrigin).href;
    }

    private _getUrl(event: GetRecordsAction) {
        let url = new URL('/api/records', this._config.recordsOrigin);

        if (hasValue(event.address)) {
            url.searchParams.set('address', event.address);
        } else if (hasValue(event.prefix)) {
            url.searchParams.set('prefix', event.prefix);
        }
        if (hasValue(event.authID)) {
            url.searchParams.set('authID', event.authID);
        }
        if (hasValue(event.cursor)) {
            url.searchParams.set('cursor', event.cursor);
        }
        if (hasValue(event.space)) {
            url.searchParams.set('space', event.space);
        }

        return url.href;
    }
}
