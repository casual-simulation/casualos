import { doesSubjectMatchPolicy, isValidUserPolicy, UserPolicy } from './DataRecordsStore';

describe('isValidUserPolicy()', () => {
    const cases: [boolean, any][] = [
        [true, true],
        [true, ['abc']],
        [true, ['abc', 'def']],
        [false, false],
        [false, null],
        [false, 123],
        [false, {}],
        [false, ['abc', 123]],
        [false, ['abc', false]],
        [false, [123, 'abc']],
    ];

    it.each(cases)('should return %s when given %s', (expected, given) => {
        expect(isValidUserPolicy(given)).toBe(expected);
    });
});

describe('doesSubjectMatchPolicy()', () => {
    const cases: [boolean, UserPolicy, string][] = [
        [true, true, 'subject'],
        [true, true, null],
        [true, ['subject'], 'subject'],
        [true, ['not_subject', 'subject'], 'subject'],
        [false, [], 'subject'],
        [false, ['not_subject'], 'subject'],
        [false, ['not_subject'], null]
    ];

    it.each(cases)('should return %s when given (%s, %s)', (expected, policy, subject) => {
        expect(doesSubjectMatchPolicy(policy, subject)).toBe(expected)
    });
});