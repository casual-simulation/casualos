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

import { failure, success } from '@casual-simulation/aux-common';
import { CustomDomainsProcessor } from './CustomDomainsProcessor';
import type { RecordsController } from '../RecordsController';

describe('CustomDomainsProcessor', () => {
    let records: { reverifyCustomDomains: jest.Mock };
    let processor: CustomDomainsProcessor;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        records = {
            reverifyCustomDomains: jest.fn(),
        };
        processor = new CustomDomainsProcessor(
            records as unknown as RecordsController
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should reverify custom domains with the options from the job', async () => {
        records.reverifyCustomDomains.mockResolvedValue(
            success({ checked: 1, failed: 0, unverifiedDomainIds: [] })
        );

        const result = await processor.process({
            type: 'custom-domains-reverify',
            maxConsecutiveFailures: 5,
            batchSize: 10,
        });

        expect(result).toEqual(success());
        expect(records.reverifyCustomDomains).toHaveBeenCalledWith({
            maxConsecutiveFailures: 5,
            batchSize: 10,
        });
    });

    it('should return the failure from the controller', async () => {
        records.reverifyCustomDomains.mockResolvedValue(
            failure({
                errorCode: 'not_supported',
                errorMessage:
                    'Custom domains are not supported on this server.',
            })
        );

        const result = await processor.process({
            type: 'custom-domains-reverify',
        });

        expect(result).toEqual(
            failure({
                errorCode: 'not_supported',
                errorMessage:
                    'Custom domains are not supported on this server.',
            })
        );
    });
});
