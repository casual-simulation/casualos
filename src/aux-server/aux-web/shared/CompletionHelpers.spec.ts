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
import { propertyInsertText } from './CompletionHelpers';

describe('CompletionHelpers', () => {
    describe('propertyInsertText()', () => {
        it('should return the property if it is alphanumeric', () => {
            expect(propertyInsertText('abc')).toEqual('.abc');
            expect(propertyInsertText('a123')).toEqual('.a123');
            expect(propertyInsertText('a_b_c')).toEqual('.a_b_c');
            expect(propertyInsertText('_1')).toEqual('._1');
        });

        it('should return the property with brackets if it is not alphanumeric', () => {
            expect(propertyInsertText('1abc')).toEqual('["1abc"]');
            expect(propertyInsertText('test.tag')).toEqual('["test.tag"]');
            expect(propertyInsertText('@fun')).toEqual('["@fun"]');
        });
    });
});
