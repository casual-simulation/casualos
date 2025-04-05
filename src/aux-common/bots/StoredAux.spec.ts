/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { BotsState } from '.';
import { createBot } from './BotCalculations';
import type {
    InstUpdate,
    StoredAuxVersion1,
    StoredAuxVersion2,
} from './StoredAux';
import { getUploadState } from './StoredAux';

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
            updates: [update],
        };

        const state = getUploadState(data);

        expect(state).toEqual({
            bot1: createBot('bot1', {
                tag1: 'abc',
            }),
        });
    });
});
