import { getBaseOrigin, getVMOrigin } from './AuxVMUtils';

console.warn = jest.fn();

describe('getVMOrigin()', () => {
    it('should return the configured origin if it is set', () => {
        const result = getVMOrigin(
            'configuredOrigin',
            'defaultOrigin',
            'instId'
        );
        expect(result).toEqual('configuredOrigin');
    });

    it('should return the default origin if no configured origin is provided', () => {
        const result = getVMOrigin(null, 'defaultOrigin', 'instId');
        expect(result).toEqual('defaultOrigin');
    });

    it('should interpolate the instId into the configured origin if possible', () => {
        const result = getVMOrigin(
            'configuredOrigin/{{inst}}',
            'defaultOrigin',
            'instId'
        );
        expect(result).toEqual('configuredOrigin/instId');
    });

    it('should replace non-alphanumeric characters with dashes', () => {
        const result = getVMOrigin(
            'configuredOrigin/{{inst}}',
            'defaultOrigin',
            '&instId$%.'
        );
        expect(result).toEqual('configuredOrigin/-instId---');
    });
});

describe('getBaseOrigin()', () => {
    it('should return the base origin of the origin', () => {
        const result = getBaseOrigin('https://test.com');
        expect(result).toEqual('https://test.com');
    });

    it('should work with simple domains', () => {
        const result = getBaseOrigin('https://localhost');
        expect(result).toEqual('https://localhost');
    });

    it('should support port numbers', () => {
        const result = getBaseOrigin('https://localhost:1234');
        expect(result).toEqual('https://localhost:1234');
    });

    it('should remove only the top subdomains from the origin', () => {
        const result = getBaseOrigin('https://abc.def.ghi.test.com');
        expect(result).toEqual('https://def.ghi.test.com');
    });

    it('should return the origin if it is not a valid URL', () => {
        const result = getBaseOrigin('not-a-valid-url');
        expect(result).toEqual('not-a-valid-url');
    });
});
