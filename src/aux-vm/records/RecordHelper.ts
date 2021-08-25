import {
    BotAction,
    PublishRecordAction,
    hasValue,
    asyncResult,
    asyncError,
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
            }
        }
    }

    private async _publishRecord(event: PublishRecordAction) {
        try {
            console.log('[RecordHelper] Publishing record...', event);
            const result = await axios.post(this._url('/api/records'), {
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
                    issuer: result.data.issuer,
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

    private _url(path: string): string {
        return new URL(path, this._config.recordsOrigin).href;
    }
}
