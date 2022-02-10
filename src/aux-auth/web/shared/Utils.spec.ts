import { isEmailValid } from './Utils';

describe('isEmailValid()', () => {
    it('should return true if given no rules', () => {
        expect(isEmailValid('myEmail', [])).toBe(true);
    });

    it('should return true if the email passes one of the allow rules', () => {
        expect(
            isEmailValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'allow' },
                { pattern: '@different\\.com$', type: 'allow' },
            ])
        ).toBe(true);
    });

    it('should return false if the email is denied by a rule', () => {
        expect(
            isEmailValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'deny' },
                { pattern: '@different\\.com$', type: 'deny' },
            ])
        ).toBe(false);
    });

    it('should return false if the email is not allowed by a rule', () => {
        expect(
            isEmailValid('myEmail@test.com', [
                { pattern: '@different\\.com$', type: 'allow' },
            ])
        ).toBe(false);
    });

    it('should return false if the email is denied before being allowed', () => {
        expect(
            isEmailValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'deny' },
                { pattern: '@test\\.com$', type: 'allow' },
            ])
        ).toBe(false);
    });

    it('should return true if the email is allowed before being denied', () => {
        expect(
            isEmailValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'allow' },
                { pattern: '@test\\.com$', type: 'deny' },
            ])
        ).toBe(true);
    });
});
