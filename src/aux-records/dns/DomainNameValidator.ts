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
 * The default number of DNS checks in a row that a verified custom domain can fail before it is marked as unverified.
 */
export const DEFAULT_MAX_CONSECUTIVE_DOMAIN_CHECK_FAILURES = 3;

/**
 * Defines an interface that helps validate domain names via DNS.
 */
export interface DomainNameValidator {
    /**
     * Validates that the given domain name is owned by whoever holds the provided verification key.
     *
     * Validation only succeeds if a TXT record containing the HMAC of the domain name (keyed by the verification key) exists.
     * Routing records (like a CNAME that points at the expected host name) are not enough to prove ownership because
     * they are the same for every studio.
     *
     * @param domainName The domain name to validate.
     * @param verificationKey The verification key to use for validation.
     * @param expectedHostName The host name that the domain should point to (via a CNAME record) for traffic to be routed to this server.
     */
    validateDomainName(
        domainName: string,
        verificationKey: string,
        expectedHostName: string
    ): Promise<Result<void, SimpleError>>;

    /**
     * Gets the DNS records that should be set for verifying the given domain name.
     * @param domainName The domain name to get the verification records for.
     * @param verificationKey The verification key to use for generating the records.
     * @param expectedHostName The host name that should be set in the CNAME record for routing traffic to this server.
     */
    getVerificationDNSRecord(
        domainName: string,
        verificationKey: string,
        expectedHostName: string
    ): Promise<Result<DomainNameVerificationDNSRecord[], SimpleError>>;
}

/**
 * Defines a DNS record that should be set for domain name verification.
 */
export interface DomainNameVerificationDNSRecord {
    /**
     * The type of DNS record that should be set for the verification.
     */
    recordType: 'TXT' | 'CNAME';

    /**
     * The fully qualified name (host) that the record should be created on.
     */
    name: string;

    /**
     * Why the record is needed.
     *
     * - "verification" records prove that the studio owns the domain and are required for verification.
     * - "routing" records direct traffic for the domain to this server.
     */
    purpose: 'verification' | 'routing';

    /**
     * The value that should be set for the verification record.
     */
    value: string;

    /**
     * The TTL (time to live) in seconds for the verification record.
     */
    ttlSeconds: number;
}
