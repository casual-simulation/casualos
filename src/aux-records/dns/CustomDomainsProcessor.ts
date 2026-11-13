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

import z from 'zod';
import type { RecordsController } from '../RecordsController';
import { DEFAULT_MAX_CONSECUTIVE_DOMAIN_CHECK_FAILURES } from './DomainNameValidator';
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import { failure, success } from '@casual-simulation/aux-common';

const TRACE_NAME = 'CustomDomainsProcessor';

/**
 * The schema for the job that re-verifies all of the verified custom domains.
 */
export const CUSTOM_DOMAINS_JOB_REVERIFY_SCHEMA = z.object({
    type: z.literal('custom-domains-reverify'),
    maxConsecutiveFailures: z
        .int()
        .positive()
        .optional()
        .describe(
            `The number of checks in a row that a verified domain has to fail before it is marked as unverified. Defaults to ${DEFAULT_MAX_CONSECUTIVE_DOMAIN_CHECK_FAILURES}.`
        ),
    batchSize: z
        .int()
        .positive()
        .optional()
        .describe(
            'The number of domains that should be loaded from the database at a time. Defaults to 100.'
        ),
});

export type CustomDomainsReverifyJob = z.infer<
    typeof CUSTOM_DOMAINS_JOB_REVERIFY_SCHEMA
>;

export type CustomDomainsJob = CustomDomainsReverifyJob;

/**
 * Defines a class that processes background jobs for custom domains.
 */
export class CustomDomainsProcessor {
    private _records: RecordsController;

    constructor(records: RecordsController) {
        this._records = records;
    }

    async process(job: CustomDomainsJob): Promise<Result<void, SimpleError>> {
        console.log(`[${TRACE_NAME}] Processing job:`, job);
        if (job.type === 'custom-domains-reverify') {
            const result = await this._records.reverifyCustomDomains({
                maxConsecutiveFailures: job.maxConsecutiveFailures,
                batchSize: job.batchSize,
            });
            if (result.success === false) {
                return result;
            }
            return success();
        }

        return failure({
            errorCode: 'not_supported',
            errorMessage: `The job type is not supported: ${
                (job as any)?.type
            }`,
        });
    }
}
