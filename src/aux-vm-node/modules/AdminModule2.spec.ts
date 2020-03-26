import {
    botAdded,
    createBot,
    shell,
    GLOBALS_BOT_ID,
    action,
} from '@casual-simulation/aux-common';
import {
    DeviceInfo,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { AuxUser, AuxConfig, Simulation } from '@casual-simulation/aux-vm';
import { AdminModule2 } from './AdminModule2';
import { Subscription } from 'rxjs';
import {
    wait,
    waitAsync,
} from '@casual-simulation/aux-common/test/TestHelpers';
import uuid from 'uuid/v4';
import { nodeSimulationForLocalRepo } from '../managers/NodeSimulationFactories';

console.error = jest.fn();
let logMock = (console.log = jest.fn());

jest.mock('child_process');

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AdminModule2', () => {
    let simulation: Simulation;
    let user: AuxUser;
    let device: DeviceInfo;
    let subject: AdminModule2;
    let sub: Subscription;

    beforeEach(async () => {
        user = {
            id: 'userId',
            isGuest: false,
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };

        simulation = nodeSimulationForLocalRepo(user, 'simulationId');
        await simulation.init();

        subject = new AdminModule2();
        sub = await subject.setup(simulation);

        logMock.mockClear();
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    describe('events', () => {
        describe('shell', () => {
            it('should run the given shell command and output the results to the console', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                await simulation.helper.transaction(
                    shell('echo "Hello, World!"')
                );

                await wait(20);

                expect(logMock).toBeCalledWith(
                    expect.stringContaining('[Shell] Hello, World!')
                );
            });

            it('should run the given shell command and output the results to the auxFinishedTasks dimension', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                uuidMock.mockReturnValue('testId');
                await simulation.helper.transaction(
                    shell('echo "Hello, World!"')
                );

                await wait(20);

                expect(simulation.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        auxFinishedTasks: true,
                        auxTaskShell: 'echo "Hello, World!"',
                        auxTaskOutput: 'Hello, World!',
                    },
                });
            });
        });

        describe('device', () => {
            it('should pipe device events through onUniverseAction()', async () => {
                await simulation.helper.createBot('test', {
                    testShout: '@setTag(this, "abc", true)',
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
                    event: action('testShout'),
                });

                await waitAsync();

                expect(simulation.helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        abc: true,
                    },
                });
            });
        });
    });

    describe('deviceConnected()', () => {
        it('should set the auxPlayerActive tag based on the session ID', async () => {
            await simulation.helper.transaction(
                botAdded(createBot(GLOBALS_BOT_ID, {}))
            );
            await simulation.helper.createBot('sessionId', {});

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            };
            await subject.deviceConnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: true,
                },
            });

            await subject.deviceDisconnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: false,
                },
            });

            await subject.deviceConnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: true,
                },
            });

            await subject.deviceDisconnected(simulation, testDevice1);

            expect(simulation.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: false,
                },
            });
        });
    });
});
