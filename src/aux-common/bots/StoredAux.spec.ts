import { BotsState } from '.';
import { createBot } from './BotCalculations';
import {
    getUploadState,
    InstUpdate,
    StoredAuxVersion1,
    StoredAuxVersion2,
} from './StoredAux';

describe('getUploadState()', () => {
    it('should support aux files that are just bot state', () => {
        const data: BotsState = {
            test: createBot('test'),
            test2: createBot('test2'),
        };

        const result = getUploadState(data);

        expect(result).toEqual(data);
    });

    it('should support aux files that contain a version number', () => {
        const data: StoredAuxVersion1 = {
            version: 1,
            state: {
                test: createBot('test'),
                test2: createBot('test2'),
            },
        };

        const result = getUploadState(data);

        expect(result).toEqual(data.state);
    });

    it('should return the state matching the given updates', () => {
        const update: InstUpdate = {
            id: 0,
            timestamp: 0,
            update: 'AQLNrtWDBQAnAQRib3RzBGJvdDEBKADNrtWDBQAEdGFnMQF3A2FiYwA=',
        };

        const data: StoredAuxVersion2 = {
            version: 2,
            update,
        };

        const state = getUploadState(data);

        expect(state).toEqual({
            bot1: createBot('bot1', {
                tag1: 'abc',
            }),
        });
    });
});
