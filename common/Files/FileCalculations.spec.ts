import {isFormula} from './FileCalculations';

describe('FileCalculations', () => {
    describe('isFormula()', () => {
        it('should be true when value starts with a "=" sign', () => {
            expect(isFormula('=')).toBeTruthy();
        });
    });
});