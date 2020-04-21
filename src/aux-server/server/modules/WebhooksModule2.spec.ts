import { nodeSimulationWithConfig } from '@casual-simulation/aux-vm-node';
import { webhook } from '@casual-simulation/aux-common';
import {
    DeviceInfo,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
} from '@casual-simulation/causal-trees';
import { WebhooksModule2 } from './WebhooksModule2';
import { AuxUser, AuxConfig, Simulation } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

jest.mock('axios');

console.log = jest.fn();

describe('WebhooksModule2', () => {
    let simulation: Simulation;
    let user: AuxUser;
    let device: DeviceInfo;
    let config: AuxConfig;
    let subject: WebhooksModule2;
    let sub: Subscription;

    beforeEach(async () => {
        user = {
            id: 'userId',
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: {
                    type: 'memory',
                    initialState: {},
                },
            },
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };

        simulation = nodeSimulationWithConfig(user, 'test', config);
        await simulation.init();

        subject = new WebhooksModule2();
        sub = await subject.setup(simulation);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    describe('events', () => {
        describe('send_webhook', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should execute webhooks', async () => {
                expect.assertions(1);

                require('axios').__setResponse({
                    data: {
                        test: true,
                    },
                });

                await simulation.helper.createBot('test', {
                    onResponse: '@setTag(this, "data", that.response.data)',
                });

                await simulation.helper.transaction(
                    webhook({
                        url: 'https://www.example.com',
                        method: 'GET',
                        responseShout: 'onResponse',
                    })
                );

                await waitAsync();

                expect(simulation.helper.botsState['test'].tags).toEqual({
                    onResponse: '@setTag(this, "data", that.response.data)',
                    data: expect.objectContaining({
                        test: true,
                    }),
                });
            });

            it('should execute webhook events from remote devices that are allowed by onUniverseAction()', async () => {
                expect.assertions(1);

                require('axios').__setResponse({
                    data: {
                        test: true,
                    },
                });

                await simulation.helper.createBot('test', {
                    onResponse: '@setTag(this, "data", that.response.data)',
                });

                await simulation.helper.createBot('filter', {
                    onUniverseAction: `@
                            if (that.action.type === 'device') {
                                action.perform(that.action.event);
                            }
                        `,
                });

                await simulation.helper.transaction({
                    type: 'device',
                    device: device,
                    event: webhook({
                        url: 'https://www.example.com',
                        method: 'GET',
                        responseShout: 'onResponse',
                    }),
                });

                await waitAsync();

                expect(simulation.helper.botsState['test'].tags).toEqual({
                    onResponse: '@setTag(this, "data", that.response.data)',
                    data: expect.objectContaining({
                        test: true,
                    }),
                });
            });
        });
    });
});
