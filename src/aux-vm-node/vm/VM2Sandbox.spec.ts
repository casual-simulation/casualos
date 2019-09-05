import { fileActionsTests } from '@casual-simulation/aux-common/Files/test/FileActionsTests';
import { VM2Sandbox } from './VM2Sandbox';
import uuid from 'uuid/v4';
import { fileCalculationContextTests } from '@casual-simulation/aux-common/Files/test/FileCalculationContextTests';
import {
    createCalculationContext,
    createFile,
    calculateFileValue,
} from '@casual-simulation/aux-common';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

const dateNowMock = (Date.now = jest.fn());

describe('VM2Sandbox', () => {
    beforeAll(() => {
        VM2Sandbox.DEFAULT_TIMEOUT = 200;
    });

    describe('actions', () => {
        fileActionsTests(uuidMock, lib => new VM2Sandbox(lib));
    });

    describe('calculations', () => {
        fileCalculationContextTests(uuidMock, dateNowMock, (files, userId) =>
            createCalculationContext(
                files,
                userId,
                undefined,
                lib => new VM2Sandbox(lib)
            )
        );
    });
});
