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
