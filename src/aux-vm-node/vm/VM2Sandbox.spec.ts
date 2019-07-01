import { fileActionsTests } from '@casual-simulation/aux-common/files/test/FileActionsTests';
import { VM2Sandbox } from './VM2Sandbox';
import uuid from 'uuid/v4';
const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('VM2Sandbox', () => {
    fileActionsTests(uuidMock, lib => new VM2Sandbox(lib));
});
