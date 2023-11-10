import { branchNamespace, branchFromNamespace } from './Utils';

describe('branchNamespace()', () => {
    it('should use the default namespace for branches', () => {
        expect(
            branchNamespace('branch', 'recordName', 'inst', 'testBranch')
        ).toBe(`/branch/recordName/inst/testBranch`);

        expect(branchNamespace('branch', null, 'inst', 'testBranch')).toBe(
            `/branch//inst/testBranch`
        );
    });
});

describe('branchFromNamespace()', () => {
    it('should parse correctly', () => {
        expect(
            branchFromNamespace('branch', '/branch/recordName/inst/testBranch')
        ).toEqual({
            recordName: 'recordName',
            inst: 'inst',
            branch: 'testBranch',
        });

        expect(
            branchFromNamespace('branch', '/branch//inst/testBranch')
        ).toEqual({
            recordName: null,
            inst: 'inst',
            branch: 'testBranch',
        });
    });
});
