import { fileActionsTests } from '@casual-simulation/aux-common/files/test/FileActionsTests';
import { VM2Sandbox } from './VM2Sandbox';
import uuid from 'uuid/v4';
import { fileCalculationContextTests } from '@casual-simulation/aux-common/Files/test/FileCalculationContextTests';
import { createCalculationContext } from '@casual-simulation/aux-common';
const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('VM2Sandbox', () => {
    describe('actions', () => {
        fileActionsTests(uuidMock, lib => new VM2Sandbox(lib));
    });

    describe('calculations', () => {
        fileCalculationContextTests(uuidMock, (files, userId) =>
            createCalculationContext(
                files,
                userId,
                undefined,
                lib => new VM2Sandbox(lib)
            )
        );
    });
});
