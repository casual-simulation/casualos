import { getVMOrigin } from './AuxVMUtils';

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
            '&instId$%'
        );
        expect(result).toEqual('configuredOrigin/-instId--');
    });
});
