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
 * The prefix of the host name that the verification TXT record should be placed on.
 * The TXT record lives on its own name (e.g. "_casualos-verification.app.example.com") so that it doesn't conflict with
 * the CNAME record that routes traffic for the domain.
 */
export const VERIFICATION_RECORD_PREFIX = '_casualos-verification';

/**
 * The prefix of the value of the verification TXT record.
 */
export const VERIFICATION_VALUE_PREFIX = 'casualos-verification=';

/**
 * Gets the host name that the verification TXT record should be placed on for the given domain name.
 * @param domainName The domain name.
 */
export function getVerificationRecordName(domainName: string): string {
    return `${VERIFICATION_RECORD_PREFIX}.${domainName}`;
}

/**
 * Defines a DNS-based domain name validator.
 *
 * A domain is only considered valid when a TXT record containing the per-domain verification hash exists.
 * The hash is an HMAC of the domain name keyed by a secret that is unique to the custom domain (and therefore the studio),
 * so it proves which studio the domain belongs to.
 *
 * The CNAME record is only used for routing traffic and is never accepted as proof of ownership, since it is the same for every studio.
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
        const expectedHash = this._generateVerificationHash(
            domainName,
            verificationKey
        );

        const recordName = getVerificationRecordName(domainName);
        const records = await resolveOrEmpty(() => dns.resolveTxt(recordName));
        console.log(
            `[DNSDomainNameValidator] Retrieved TXT records for ${recordName}:`,
            records
        );
        if (hasVerificationHash(records, expectedHash)) {
            return success();
        }

        // Older setups placed the TXT record directly on the domain name.
        // The hash is still unique to the studio, so it still proves ownership.
        const legacyRecords = await resolveOrEmpty(() =>
            dns.resolveTxt(domainName)
        );
        console.log(
            `[DNSDomainNameValidator] Retrieved TXT records for ${domainName}:`,
            legacyRecords
        );
        if (hasVerificationHash(legacyRecords, expectedHash)) {
            return success();
        }

        const hasAnyVerificationRecord =
            hasVerificationRecord(records) ||
            hasVerificationRecord(legacyRecords);

        return failure({
            errorCode: 'not_found',
            errorMessage: hasAnyVerificationRecord
                ? `The DNS TXT record on ${recordName} does not contain the expected verification value.`
                : `No DNS TXT verification record was found on ${recordName}.`,
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
        return success([
            {
                recordType: 'TXT',
                name: getVerificationRecordName(domainName),
                value: `${VERIFICATION_VALUE_PREFIX}${hash}`,
                ttlSeconds: 32600,
                purpose: 'verification',
            },
            {
                recordType: 'CNAME',
                name: domainName,
                value: expectedHostName,
                ttlSeconds: 32600,
                purpose: 'routing',
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
 * Determines whether the given TXT records contain a verification record with the given hash.
 * @param records The TXT records.
 * @param expectedHash The expected hash.
 */
function hasVerificationHash(
    records: string[][],
    expectedHash: string
): boolean {
    for (let r of records) {
        for (let txt of r) {
            if (
                txt.startsWith(VERIFICATION_VALUE_PREFIX) &&
                txt.slice(VERIFICATION_VALUE_PREFIX.length) === expectedHash
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Determines whether the given TXT records contain any verification record.
 * @param records The TXT records.
 */
function hasVerificationRecord(records: string[][]): boolean {
    return records.some((r) =>
        r.some((txt) => txt.startsWith(VERIFICATION_VALUE_PREFIX))
    );
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
