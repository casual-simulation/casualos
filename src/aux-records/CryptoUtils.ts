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
import { padStart } from 'es-toolkit/compat';
import { randomBytes } from 'tweetnacl';

/**
 * The number of characters that random codes should contain.
 */
export const RANDOM_CODE_LENGTH = 6;

/**
 * Creates a new random numerical code.
 */
export function randomCode(): string {
    const bytes = randomBytes(4);
    const int32 = new Uint32Array(bytes.buffer);
    const str = padStart(
        int32[0].toString().substring(0, RANDOM_CODE_LENGTH),
        RANDOM_CODE_LENGTH,
        '0'
    );
    return str;
}
