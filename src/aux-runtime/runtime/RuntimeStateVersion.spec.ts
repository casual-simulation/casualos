import { updateRuntimeVersion } from './RuntimeStateVersion';

describe('updateRuntimeVersion()', () => {
    it('should add the new local site to the local sites', () => {
        const result = updateRuntimeVersion(
            {
                currentSite: 'abc',
                remoteSite: 'def',
                vector: {
                    abc: 123,
                },
            },
            {
                localSites: {},
                vector: {},
            }
        );

        expect(result).toEqual({
            localSites: {
                abc: true,
            },
            vector: {
                abc: 123,
            },
        });
    });
});
