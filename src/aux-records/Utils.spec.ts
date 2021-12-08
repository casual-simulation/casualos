import { toBase64String, fromBase64String } from './Utils';

const cases = [['abc', 'YWJj']];

it.each(cases)('toBase64String(%s) -> %s', (input, output) => {
    const result = toBase64String(input);

    expect(result).toBe(output);
});

it.each(cases)('%s <- fromBase64String(%s)', (input, output) => {
    const result = fromBase64String(output);

    expect(result).toBe(input);
});
