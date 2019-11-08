import { NullDeviceAuthenticator } from '.';
import {
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    USER_ROLE,
} from '@casual-simulation/causal-trees';

describe('NullDeviceAuthenticator', () => {
    let subject: NullDeviceAuthenticator;

    beforeEach(() => {
        subject = new NullDeviceAuthenticator();
    });

    describe('authenticate()', () => {
        it('should use the ID from the user', async () => {
            const result = await subject
                .authenticate({
                    id: 'id',
                    token: 'token',
                    username: 'username',
                })
                .toPromise();

            expect(result).toEqual({
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: 'username',
                        [SESSION_ID_CLAIM]: 'id',
                    },
                    roles: [USER_ROLE],
                },
            });
        });
    });
});
