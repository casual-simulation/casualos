import { botActionsTests } from '@casual-simulation/aux-common/bots/test/BotActionsTests';
import { VM2Sandbox } from './VM2Sandbox';
import uuid from 'uuid/v4';
import { botCalculationContextTests } from '@casual-simulation/aux-common/bots/test/BotCalculationContextTests';
import {
    createCalculationContext,
    createBot,
    calculateBotValue,
} from '@casual-simulation/aux-common';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

const dateNowMock = (Date.now = jest.fn());
console.error = jest.fn();

describe('VM2Sandbox', () => {
    beforeAll(() => {
        VM2Sandbox.DEFAULT_TIMEOUT = 10000;
    });

    describe('actions', () => {
        botActionsTests(uuidMock, lib => new VM2Sandbox(lib));
    });

    describe('calculations', () => {
        botCalculationContextTests(uuidMock, dateNowMock, (bots, userId) =>
            createCalculationContext(
                bots,
                userId,
                undefined,
                lib => new VM2Sandbox(lib)
            )
        );
    });
});
