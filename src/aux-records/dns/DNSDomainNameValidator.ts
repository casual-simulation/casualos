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

import {
    failure,
    success,
    type Result,
    type SimpleError,
} from '@casual-simulation/aux-common';
import type {
    DomainNameValidator,
    DomainNameVerificationDNSRecord,
} from './DomainNameValidator';
import dns from 'node:dns/promises';
import { hmac, sha256 } from 'hash.js';

/**
 * Defines a DNS-based domain name validator.
 */
export class DNSDomainNameValidator implements DomainNameValidator {
    async validateDomainName(
        domainName: string,
        verificationKey: string,
        expectedHostName: string
    ): Promise<Result<void, SimpleError>> {
        console.log(
            `[DNSDomainNameValidator] Validating domain name: ${domainName}`
        );
        const records = await resolveOrEmpty(() => dns.resolveTxt(domainName));

        const expectedHash = this._generateVerificationHash(
            domainName,
            verificationKey
        );
        console.log(`[DNSDomainNameValidator] Retrieved TXT records:`, records);
        for (let r of records) {
            for (let txt of r) {
                if (txt.startsWith(`casualos-verification=`)) {
                    const hash = txt.slice('casualos-verification='.length);
                    if (hash === expectedHash) {
                        return success();
                    }
                }
            }
        }

        const cnameRecords = await resolveOrEmpty(() =>
            dns.resolveCname(domainName)
        );
        console.log(
            `[DNSDomainNameValidator] Retrieved CNAME records:`,
            cnameRecords
        );
        if (cnameRecords.length >= 2) {
            return failure({
                errorCode: 'record_already_exists',
                errorMessage:
                    'Multiple CNAME records found for the domain name. Please ensure that only one CNAME record is set for the domain name.',
            });
        }
        for (let cname of cnameRecords) {
            if (cname.trim() === expectedHostName) {
                return success();
            }
        }

        return failure({
            errorCode: 'not_found',
            errorMessage: getMissingRecordsMessage(
                records.length > 0,
                cnameRecords.length > 0
            ),
        });
    }

    async getVerificationDNSRecord(
        domainName: string,
        verificationKey: string,
        expectedHostName: string
    ): Promise<Result<DomainNameVerificationDNSRecord[], SimpleError>> {
        const hash = this._generateVerificationHash(
            domainName,
            verificationKey
        );
        const record: DomainNameVerificationDNSRecord = {
            recordType: 'TXT',
            value: `casualos-verification=${hash}`,
            ttlSeconds: 32600,
        };
        return success([
            record,
            {
                recordType: 'CNAME',
                value: expectedHostName,
                ttlSeconds: 32600,
            },
        ]);
    }

    private _generateVerificationHash(
        domainName: string,
        verificationKey: string
    ): string {
        const sha = hmac(<any>sha256, verificationKey);
        return sha.update(domainName).digest('hex');
    }
}

/**
 * The DNS error codes that indicate that a domain has no records of the requested type.
 */
const NO_RECORDS_ERROR_CODES = new Set(['ENODATA', 'ENOTFOUND']);

/**
 * Runs the given DNS lookup and returns an empty list if the domain has no records of the requested type.
 * Other errors are rethrown.
 * @param lookup The function that performs the lookup.
 */
async function resolveOrEmpty<T>(lookup: () => Promise<T[]>): Promise<T[]> {
    try {
        return await lookup();
    } catch (err) {
        if (err && NO_RECORDS_ERROR_CODES.has(err.code)) {
            return [];
        }
        throw err;
    }
}

function getMissingRecordsMessage(hasTxt: boolean, hasCname: boolean): string {
    if (!hasTxt && !hasCname) {
        return 'No DNS TXT or CNAME records were found for the domain name.';
    } else if (!hasTxt) {
        return 'No DNS TXT records were found for the domain name, and the CNAME record does not point to the expected host name.';
    } else if (!hasCname) {
        return 'No DNS CNAME records were found for the domain name, and the TXT records do not contain the expected verification value.';
    }
    return 'The DNS TXT records do not contain the expected verification value, and the CNAME record does not point to the expected host name.';
}
