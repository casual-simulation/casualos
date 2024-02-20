import {
    branchNamespace,
    branchFromNamespace,
    parseInstId,
    normalizeInstId,
} from './Utils';

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

describe('parseInstId()', () => {
    const cases = [
        [null as any, null as any] as const,
        ['abc', null as any] as const,
        ['/abc', { recordName: null as any, inst: 'abc' }] as const,
        ['record/abc', { recordName: 'record', inst: 'abc' }] as const,
    ];

    it.each(cases)('should parse %s', (input: string, expected: any) => {
        const result = parseInstId(input);
        expect(result).toEqual(expected);
    });
});

describe('normalizeInstId()', () => {
    const cases = [
        [null as any, null as any],
        ['abc', '/abc'],
        ['/abc', '/abc'],
        ['record/abc', 'record/abc'],
    ];

    it.each(cases)(
        'should normalize %s to %s',
        (input: string, expected: string) => {
            const result = normalizeInstId(input);
            expect(result).toEqual(expected);
        }
    );
});
