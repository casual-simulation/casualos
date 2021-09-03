import {
    BotAction,
    PublishRecordAction,
    hasValue,
    asyncResult,
    asyncError,
    GetRecordsAction,
} from '@casual-simulation/aux-common';
import { AuxConfigParameters } from '../vm/AuxConfig';
import { AuxHelper } from '../vm/AuxHelper';
import axios from 'axios';

/**
 * Defines a class that provides capabilities for storing and retrieving records.
 */
export class RecordHelper {
    private _config: AuxConfigParameters;
    private _helper: AuxHelper;

    constructor(config: AuxConfigParameters, helper: AuxHelper) {
        this._config = config;
        this._helper = helper;
    }

    handleEvents(events: BotAction[]): void {
        for (let event of events) {
            if (event.type === 'publish_record') {
                this._publishRecord(event);
            } else if (event.type === 'get_records') {
                this._getRecords(event);
            }
        }
    }

    private async _publishRecord(event: PublishRecordAction) {
        try {
            console.log('[RecordHelper] Publishing record...', event);
            const result = await axios.post(this._publishUrl('/api/records'), {
                token: event.token,
                address: event.address,
                space: event.space,
                record: event.record,
            });

            console.log('[RecordHelper] Record published!');
            if (hasValue(event.taskId)) {
                let response = {
                    address: result.data.address,
                    space: result.data.space,
                    authID: result.data.issuer,
                };
                this._helper.transaction(asyncResult(event.taskId, response));
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

    private async _getRecords(event: GetRecordsAction) {
        try {
            console.log('[RecordHelper] Getting records...', event);
            let headers = {} as any;
            if (hasValue(event.token)) {
                headers.Authorization = `Bearer ${event.token}`;
            } else {
                headers.Authorization = 'None';
            }
            const result = await axios.get(this._getUrl(event), {
                headers: headers,
            });

            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        records: result.data.records,
                        cursor: result.data.cursor,
                        hasMoreRecords: result.data.hasMoreRecords,
                        totalCount: result.data.totalCount,
                    })
                );
            }
        } catch (e) {
            console.error('[RecordHelper] Error getting records:', e);
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
