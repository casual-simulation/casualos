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
import { Vector3 } from '@casual-simulation/three';
import { cartesianToLatLon, latLonToCartesian } from './CoordinateSystem';

describe('CoordinateSystem', () => {
    describe('latLonToCartesian()', () => {
        it('should return a Vector3 for the given latitude and longitude and altitude', () => {
            let input = new Vector3(9, 12, 15);
            let output = latLonToCartesian(1, input);
            expect(output).toMatchSnapshot();
        });
    });

    describe('cartesianToLatLon()', () => {
        it('should return a Vector3 for the given latitude and longitude and altitude', () => {
            let input = new Vector3(
                15.457679690014206,
                3.285631246305953,
                2.502951440643694
            );
            let output = cartesianToLatLon(1, input);

            expect(output.x).toBeCloseTo(9);
            expect(output.y).toBeCloseTo(12);
            expect(output.z).toBeCloseTo(15);
        });
    });
});
