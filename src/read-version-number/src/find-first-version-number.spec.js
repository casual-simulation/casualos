const {
    findFirstVersionNumber,
    formatVersionNumber,
} = require('./find-first-version-number');

describe('findFirstVersionNumber()', () => {
    it('should return the first occurance of a version number in the text', () => {
        const text = `
        V1.0.0
        V1.45.1
        v1.0.87
        `;

        const version = findFirstVersionNumber(text);

        expect(version).toEqual({
            major: '1',
            minor: '0',
            patch: '0',
        });
    });
});

describe('formatVersionNumber()', () => {
    it('should format the given version number to a string', () => {
        const version = formatVersionNumber({
            major: '1',
            minor: '5',
            patch: '8',
        });

        expect(version).toEqual('1.5.8');
    });
});
