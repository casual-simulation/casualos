import { getFinalUrl, getFinalProtocol, isSecureProtocol } from './UrlHelpers';

describe('UrlHelpers', () => {
    describe('getFinalUrl()', () => {
        it('should use the default URL if no override is provided', () => {
            expect(getFinalUrl('http://example.com', null)).toEqual(
                'http://example.com'
            );
        });

        it('should use the given override host if provided', () => {
            expect(
                getFinalUrl('http://example.com', 'http://different.com')
            ).toEqual('http://different.com');
        });

        it('should use the protocol from the default if it is more secure', () => {
            expect(
                getFinalUrl('https://example.com', 'http://different.com')
            ).toEqual('https://different.com');
        });

        it('should use the protocol from the override if it is more secure', () => {
            expect(
                getFinalUrl('http://example.com', 'https://different.com')
            ).toEqual('https://different.com');
        });
    });

    describe('getFinalProtocol()', () => {
        const cases = [
            ['http:', 'http:', 'http:'],
            ['https:', 'http:', 'https:'],
            ['http:', 'https:', 'https:'],
            ['https:', 'https:', 'https:'],
        ];
        it.each(cases)(
            'should use the most secure protocol [%s, %s, %s]',
            (first, second, expected) => {
                expect(getFinalProtocol(first, second)).toEqual(expected);
            }
        );
    });

    describe('isSecureProtocol()', () => {
        const cases = [['http:', false], ['https:', true]];
        it.each(cases)('should map %s to %s', (protocol, expected) => {
            expect(isSecureProtocol(protocol)).toBe(expected);
        });
    });
});
