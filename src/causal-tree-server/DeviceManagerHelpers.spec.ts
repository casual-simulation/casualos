import {
    DeviceInfo,
    USERNAME_CLAIM,
    SESSION_ID_CLAIM,
    DEVICE_ID_CLAIM,
} from '@casual-simulation/causal-trees';
import { isEventForDevice } from './DeviceManagerHelpers';

describe('DeviceManagerHelpers', () => {
    describe('isDeviceForEvent()', () => {
        const usernameCases = [
            [true, 'matches', 'username', 'username'],
            [false, 'does not match', 'username', 'no match'],
        ];

        it.each(usernameCases)(
            'should return %s if the username %s',
            (expected, desc, deviceUsername, eventUsername) => {
                let device: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: deviceUsername,
                        [DEVICE_ID_CLAIM]: 'deviceId',
                        [SESSION_ID_CLAIM]: 'sessionId',
                    },
                    roles: [],
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            username: eventUsername,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        const sessionIdCases = [
            [true, 'matches', 'sessionId', 'sessionId'],
            [false, 'does not match', 'sessionId', 'no match'],
        ];

        it.each(sessionIdCases)(
            'should return %s if the session ID %s',
            (expected, desc, deviceSessionId, eventSessionId) => {
                let device: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: 'deviceId',
                        [SESSION_ID_CLAIM]: deviceSessionId,
                    },
                    roles: [],
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            sessionId: eventSessionId,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        const deviceIdCases = [
            [true, 'matches', 'deviceId', 'deviceId'],
            [false, 'does not match', 'deviceId', 'no match'],
        ];

        it.each(deviceIdCases)(
            'should return %s if the device ID %s',
            (expected, desc, deviceId, eventDeviceId) => {
                let device: DeviceInfo = {
                    claims: {
                        [USERNAME_CLAIM]: 'username',
                        [DEVICE_ID_CLAIM]: deviceId,
                        [SESSION_ID_CLAIM]: 'sessionId',
                    },
                    roles: [],
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            deviceId: eventDeviceId,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );
    });
});
