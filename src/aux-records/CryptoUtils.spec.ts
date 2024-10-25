import { randomCode, RANDOM_CODE_LENGTH } from './CryptoUtils';

describe('randomCode()', () => {
    it('should generate a random number code with 6 characters', () => {
        const numbers = new Set<string>();
        let numDuplicates = 0;
        for (let i = 0; i < 100; i++) {
            const code = randomCode();
            expect(code).toHaveLength(RANDOM_CODE_LENGTH);
            expect(code).not.toBe('000000');
            if (numbers.has(code)) {
                numDuplicates++;
            }
            numbers.add(code);
        }
        // There might be a duplicate or two every so often, but it should be rare.
        expect(numDuplicates).toBeLessThan(3);
    });
});
