/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { waitAsync } from '../test/TestHelpers';
import type { PartitionAuthRequest } from './PartitionAuthSource';
import { PartitionAuthSource } from './PartitionAuthSource';

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
                branch: 'my-branch',
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
                    branch: 'my-branch',
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
                branch: 'my-branch',
            },
        });

        expect(requests.slice(1)).toEqual([]);

        expect(promise1 === promise2).toBe(true);
    });

    it('should de-duplicate requests even if they have been responded to', async () => {
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
                branch: 'my-branch',
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
                    branch: 'my-branch',
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
                branch: 'my-branch',
            },
        });

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
                    branch: 'my-branch',
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
                branch: 'my-branch',
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
                    branch: 'my-branch',
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
                branch: 'my-branch',
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
                    branch: 'my-branch',
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
