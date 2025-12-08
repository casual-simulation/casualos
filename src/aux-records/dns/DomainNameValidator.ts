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

import type { Result, SimpleError } from '@casual-simulation/aux-common';

/**
 * Defines an interface that helps validate domain names via DNS.
 */
export interface DomainNameValidator {
    /**
     * Validates the given domain name using the provided verification key.
     * @param domainName The domain name to validate.
     * @param verificationKey The verification key to use for validation.
     */
    validateDomainName(
        domainName: string,
        verificationKey: string
    ): Promise<Result<void, SimpleError>>;

    /**
     * Gets the DNS record that should be set for verifying the given domain name.
     * @param domainName The domain name to get the verification record for.
     * @param verificationKey The verification key to use for generating the record.
     */
    getVerificationDNSRecord(
        domainName: string,
        verificationKey: string
    ): Promise<Result<DomainNameVerificationDNSRecord, SimpleError>>;
}

/**
 * Defines a DNS record that should be set for domain name verification.
 */
export interface DomainNameVerificationDNSRecord {
    /**
     * The type of DNS record that should be set for the verification.
     */
    recordType: 'TXT';

    /**
     * The value that should be set for the verification record.
     */
    value: string;

    /**
     * The TTL (time to live) in seconds for the verification record.
     */
    ttlSeconds: number;
}
