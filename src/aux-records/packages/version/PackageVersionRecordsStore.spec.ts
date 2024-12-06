import { getPackageVersionKey } from './PackageVersionRecordsStore';

describe('getPackageVersionKey()', () => {
    it('should be able to parse the given key', () => {
        expect(getPackageVersionKey('v1.0.0', null, 0, 0, '')).toEqual({
            success: true,
            key: {
                major: 1,
                minor: 0,
                patch: 0,
                tag: '',
            },
        });
    });

    it('should be able use the given major, minor, patch and tag', () => {
        expect(getPackageVersionKey(null, 1, 0, 0, '')).toEqual({
            success: true,
            key: {
                major: 1,
                minor: 0,
                patch: 0,
                tag: '',
            },
        });
    });
});
