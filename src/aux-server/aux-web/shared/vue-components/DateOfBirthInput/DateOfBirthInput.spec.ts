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
import DateOfBirthInput from './DateOfBirthInput';

describe('DateOfBirthInput', () => {
    it('should validate dates correctly', () => {
        const component = new DateOfBirthInput();

        // Invalid month
        component.month = '13';
        component.day = '01';
        component.year = '2000';
        expect(component.isValidDate()).toBe(false);

        // Invalid day
        component.month = '01';
        component.day = '32';
        component.year = '2000';
        expect(component.isValidDate()).toBe(false);

        // Invalid day for month (February 30)
        component.month = '02';
        component.day = '30';
        component.year = '2000';
        expect(component.isValidDate()).toBe(false);

        // Valid date
        component.month = '01';
        component.day = '15';
        component.year = '2000';
        expect(component.isValidDate()).toBe(true);
    });

    it('should handle leap years correctly', () => {
        const component = new DateOfBirthInput();

        // February 29 on leap year (2000)
        component.month = '02';
        component.day = '29';
        component.year = '2000';
        expect(component.isValidDate()).toBe(true);

        // February 29 on non-leap year (2001)
        component.month = '02';
        component.day = '29';
        component.year = '2001';
        expect(component.isValidDate()).toBe(false);
    });
});
