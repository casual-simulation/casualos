import { Vector3 } from '@casual-simulation/three';
import { cartesianToLatLon, latLonToCartesian } from './CoordinateSystem';

describe('CoordinateSystem', () => {
    describe('latLonToCartesian()', () => {
        it('should return a Vector3 for the given latitude and longitude and altitude', () => {
            let input = new Vector3(10, 10, 15);
            let output = latLonToCartesian(1, input);
            expect(output).toMatchSnapshot();
        });
    });

    describe('cartesianToLatLon()', () => {
        it('should return a Vector3 for the given latitude and longitude and altitude', () => {
            let input = new Vector3(
                15.517540966287266,
                2.7361611466053493,
                2.7783708426708853
            );
            let output = cartesianToLatLon(1, input);

            expect(output.x).toBeCloseTo(10);
            expect(output.y).toBeCloseTo(10);
            expect(output.z).toBeCloseTo(15);
        });
    });
});
