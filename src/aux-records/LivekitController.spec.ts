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
import { LivekitController } from './LivekitController';
import type {
    IssueMeetTokenFailure,
    IssueMeetTokenSuccess,
} from './LivekitEvents';
import { TokenVerifier } from 'livekit-server-sdk';

describe('LivekitController', () => {
    let controller: LivekitController;
    let verifier: TokenVerifier;

    beforeEach(() => {
        controller = new LivekitController(
            'apiKey',
            'secretKey',
            'ws://endpoint'
        );
        verifier = new TokenVerifier('apiKey', 'secretKey');
    });

    describe('issueToken()', () => {
        it('should return a JWT token', async () => {
            const result = (await controller.issueToken(
                'myRoom',
                'myUsername'
            )) as IssueMeetTokenSuccess;

            expect(result).toEqual({
                success: true,
                roomName: 'myRoom',
                url: 'ws://endpoint',
                token: expect.any(String),
            });

            verifier.verify(result.token);
        });

        it('should return an error if given an empty room name', async () => {
            const result = (await controller.issueToken(
                '',
                'myUsername'
            )) as IssueMeetTokenFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_room_name',
                errorMessage:
                    'Invalid room name. It must not be null or empty.',
            });
        });

        it('should return an error if given an empty username', async () => {
            const result = (await controller.issueToken(
                'myRoom',
                ''
            )) as IssueMeetTokenFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_username',
                errorMessage: 'Invalid Username. It must not be null or empty.',
            });
        });

        it('should return a not_supported error if the controller has no api key', async () => {
            controller = new LivekitController(
                null,
                'secretKey',
                'ws://endpoint'
            );
            const result = (await controller.issueToken(
                'myRoom',
                'username'
            )) as IssueMeetTokenFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Meetings are not supported on this inst.',
            });
        });

        it('should return a not_supported error if the controller has no secret key', async () => {
            controller = new LivekitController('apiKey', null, 'ws://endpoint');
            const result = (await controller.issueToken(
                'myRoom',
                'username'
            )) as IssueMeetTokenFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Meetings are not supported on this inst.',
            });
        });

        it('should return a not_supported error if the controller has no endpoint', async () => {
            controller = new LivekitController('apiKey', 'secretKey', null);
            const result = (await controller.issueToken(
                'myRoom',
                'username'
            )) as IssueMeetTokenFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Meetings are not supported on this inst.',
            });
        });
    });
});
