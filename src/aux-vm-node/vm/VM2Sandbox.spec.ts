import { fileActionsTests } from '@casual-simulation/aux-common/files/test/FileActionsTests';
import { VM2Sandbox } from './VM2Sandbox';
import uuid from 'uuid/v4';
import { fileCalculationContextTests } from '@casual-simulation/aux-common/Files/test/FileCalculationContextTests';
import {
    createCalculationContext,
    createFile,
    calculateFileValue,
} from '@casual-simulation/aux-common';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';
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

    describe('denial of service', () => {
        it('should handle while(true) scripts', () => {
            let file = createFile('test', {
                formula: '=while(true){}',
            });
            let context = createCalculationContext(
                [file],
                'user',
                undefined,
                lib => new VM2Sandbox(lib)
            );

            const value = calculateFileValue(context, file, 'formula');

            expect(value).toEqual(new Error('Script execution timed out.'));
        });
    });
});
