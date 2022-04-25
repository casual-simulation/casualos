import { isStringValid } from './Utils';

describe('isStringValid()', () => {
    it('should return true if given no rules', () => {
        expect(isStringValid('myEmail', [])).toBe(true);
    });

    it('should return true if the email passes one of the allow rules', () => {
        expect(
            isStringValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'allow' },
                { pattern: '@different\\.com$', type: 'allow' },
            ])
        ).toBe(true);
    });

    it('should return false if the email is denied by a rule', () => {
        expect(
            isStringValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'deny' },
                { pattern: '@different\\.com$', type: 'deny' },
            ])
        ).toBe(false);
    });

    it('should return false if the email is not allowed by a rule', () => {
        expect(
            isStringValid('myEmail@test.com', [
                { pattern: '@different\\.com$', type: 'allow' },
            ])
        ).toBe(false);
    });

    it('should return false if the email is denied before being allowed', () => {
        expect(
            isStringValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'deny' },
                { pattern: '@test\\.com$', type: 'allow' },
            ])
        ).toBe(false);
    });

    it('should return true if the email is allowed before being denied', () => {
        expect(
            isStringValid('myEmail@test.com', [
                { pattern: '@test\\.com$', type: 'allow' },
                { pattern: '@test\\.com$', type: 'deny' },
            ])
        ).toBe(true);
    });

    it('should support SMS codes', () => {
        expect(
            isStringValid('+16165551234', [
                { pattern: '^\\+1616', type: 'allow' }
            ])
        ).toBe(true);

        expect(
            isStringValid('+26165551234', [
                { pattern: '^\\+1616', type: 'allow' }
            ])
        ).toBe(false);
    })
});
