import { LivekitController } from './LivekitController';
import { IssueMeetTokenFailure, IssueMeetTokenSuccess } from './LivekitEvents';
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
