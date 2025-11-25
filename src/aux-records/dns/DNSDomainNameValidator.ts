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
        verificationKey: string
    ): Promise<Result<void, SimpleError>> {
        const records = await dns.resolveTxt(domainName);

        const expectedHash = this._generateVerificationHash(
            domainName,
            verificationKey
        );
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

        return failure({
            errorCode: 'not_found',
            errorMessage:
                'A valid DNS TXT record was not found for the domain name.',
        });
    }

    async getVerificationDNSRecord(
        domainName: string,
        verificationKey: string
    ): Promise<Result<DomainNameVerificationDNSRecord, SimpleError>> {
        const hash = this._generateVerificationHash(
            domainName,
            verificationKey
        );
        const record: DomainNameVerificationDNSRecord = {
            recordType: 'TXT',
            value: `casualos-verification=${hash}`,
            ttlSeconds: 32600,
        };
        return success(record);
    }

    private _generateVerificationHash(
        domainName: string,
        verificationKey: string
    ): string {
        const sha = hmac(<any>sha256, verificationKey);
        return sha.update(domainName).digest('hex');
    }
}
