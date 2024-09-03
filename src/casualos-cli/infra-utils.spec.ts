import { getRepoName } from './infra-utils';

describe('getRepoName()', () => {
    const cases = [
        ['./infra/test', 'infra-test'],
        ['C:/infra/test', 'infra-test'],
        ['D:/infra/test', 'infra-test'],
        ['~/infra/test', 'infra-test'],
        ['/root/infra/test', 'root-infra-test'],
    ];

    it.each(cases)('should return %s for %s', (path, expected) => {
        expect(getRepoName(path)).toBe(expected);
    });
});
