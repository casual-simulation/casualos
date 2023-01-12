import { createBot } from './BotCalculations';
import { getUploadState } from './StoredAux';

describe('getUploadState()', () => {
    it('should support aux files that are just bot state', () => {
        const data = {
            test: createBot('test'),
            test2: createBot('test2'),
        };

        const result = getUploadState(data);

        expect(result).toEqual(data);
    });

    it('should support aux files that contain a version number', () => {
        const data = {
            version: 1,
            state: {
                test: createBot('test'),
                test2: createBot('test2'),
            },
        };

        const result = getUploadState(data);

        expect(result).toEqual(data.state);
    });
});
