import { waitAsync } from '../test/TestHelpers';
import {
    PartitionAuthRequest,
    PartitionAuthSource,
} from './PartitionAuthSource';

describe('PartitionAuthSource', () => {
    let source: PartitionAuthSource;

    beforeEach(() => {
        source = new PartitionAuthSource();
    });

    it('should de-duplicate requests that have the same origin, kind, error code and resource', async () => {
        let requests: PartitionAuthRequest[] = [];
        source.onAuthRequest.subscribe((e) => {
            requests.push(e);
        });

        let promise1 = source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'not_authorized',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
            resource: {
                type: 'inst',
                inst: 'my-inst',
                recordName: 'my-record',
            },
        });

        await waitAsync();

        expect(requests).toEqual([
            {
                type: 'request',
                origin: 'my-origin',
                kind: 'not_authorized',
                errorCode: 'not_logged_in',
                errorMessage: 'not logged in',
                resource: {
                    type: 'inst',
                    inst: 'my-inst',
                    recordName: 'my-record',
                },
            },
        ]);

        let promise2 = source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'not_authorized',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
            resource: {
                type: 'inst',
                inst: 'my-inst',
                recordName: 'my-record',
            },
        });

        expect(requests.slice(1)).toEqual([]);

        expect(promise1 === promise2).toBe(true);
    });

    it('should not de-duplicate requests if they have been responded to', async () => {
        let requests: PartitionAuthRequest[] = [];
        source.onAuthRequest.subscribe((e) => {
            requests.push(e);
        });

        source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'not_authorized',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
            resource: {
                type: 'inst',
                inst: 'my-inst',
                recordName: 'my-record',
            },
        });

        await waitAsync();

        expect(requests).toEqual([
            {
                type: 'request',
                origin: 'my-origin',
                kind: 'not_authorized',
                errorCode: 'not_logged_in',
                errorMessage: 'not logged in',
                resource: {
                    type: 'inst',
                    inst: 'my-inst',
                    recordName: 'my-record',
                },
            },
        ]);

        source.sendAuthResponse({
            type: 'response',
            success: true,
            origin: 'my-origin',
            indicator: {
                connectionId: 'id',
            },
        });

        await waitAsync();

        source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'not_authorized',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
            resource: {
                type: 'inst',
                inst: 'my-inst',
                recordName: 'my-record',
            },
        });

        expect(requests.slice(1)).toEqual([
            {
                type: 'request',
                origin: 'my-origin',
                kind: 'not_authorized',
                errorCode: 'not_logged_in',
                errorMessage: 'not logged in',
                resource: {
                    type: 'inst',
                    inst: 'my-inst',
                    recordName: 'my-record',
                },
            },
        ]);
    });

    it('should not de-duplicate requests that have a different kind', async () => {
        let requests: PartitionAuthRequest[] = [];
        source.onAuthRequest.subscribe((e) => {
            requests.push(e);
        });

        let promise1 = source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'need_indicator',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
            resource: {
                type: 'inst',
                inst: 'my-inst',
                recordName: 'my-record',
            },
        });

        await waitAsync();

        expect(requests).toEqual([
            {
                type: 'request',
                origin: 'my-origin',
                kind: 'need_indicator',
                errorCode: 'not_logged_in',
                errorMessage: 'not logged in',
                resource: {
                    type: 'inst',
                    inst: 'my-inst',
                    recordName: 'my-record',
                },
            },
        ]);

        let promise2 = source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'not_authorized',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
            resource: {
                type: 'inst',
                inst: 'my-inst',
                recordName: 'my-record',
            },
        });

        expect(requests.slice(1)).toEqual([
            {
                type: 'request',
                origin: 'my-origin',
                kind: 'not_authorized',
                errorCode: 'not_logged_in',
                errorMessage: 'not logged in',
                resource: {
                    type: 'inst',
                    inst: 'my-inst',
                    recordName: 'my-record',
                },
            },
        ]);

        expect(promise1 === promise2).toBe(false);
    });

    it('should be able to de-duplicate requests that do not have a resource', async () => {
        let requests: PartitionAuthRequest[] = [];
        source.onAuthRequest.subscribe((e) => {
            requests.push(e);
        });

        let promise1 = source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'need_indicator',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
        });

        await waitAsync();

        expect(requests).toEqual([
            {
                type: 'request',
                origin: 'my-origin',
                kind: 'need_indicator',
                errorCode: 'not_logged_in',
                errorMessage: 'not logged in',
            },
        ]);

        let promise2 = source.sendAuthRequest({
            type: 'request',
            origin: 'my-origin',
            kind: 'need_indicator',
            errorCode: 'not_logged_in',
            errorMessage: 'not logged in',
        });

        expect(requests.slice(1)).toEqual([]);
        expect(promise1 === promise2).toBe(true);
    });
});
