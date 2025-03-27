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

export type SignatureAlgorithmType = ECDSA_SHA256_NISTP256;

/**
 * Defines a signature algorithm that uses ECDSA Curve P-256 for signing and verification
 * and SHA-256 for message integrity.
 *
 * Basically this gives us 2 things:
 * 1. A digital signature. This means we can verify that only the party with the private key could have created a message.
 * 2. A hash. This means we can verify that the data hasn't changed while in transit. This helps prevent chosen ciphertext attacks because
 *    it's supposed to catch any changes to the ciphertext before signature verification occurs.
 */
export type ECDSA_SHA256_NISTP256 = 'ECDSA-SHA256-NISTP256';
