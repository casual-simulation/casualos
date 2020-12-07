import src from '../src';
import cjs from '../src/cjs';
import setup from './setup';

beforeAll(() => {
    setup();
});

describe('cjs', () => {
    it('should exported', () => {
        expect(cjs).toEqual(src);
    });
});
