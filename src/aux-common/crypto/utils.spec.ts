import { formatPublicPEMKey, formatPrivatePEMKey, parsePrivatePEMKey, parsePublicPEMKey } from './utils';

describe('crypto', () => {
    describe('utils', () => {
        describe('formatPublicPEMKey()', () => {
            it('should include the public key header and footer', () => {
                const val = 'hello';
                const buffer = Buffer.from(val);
                const pem = formatPublicPEMKey(buffer);

                expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
                expect(pem).toMatch(/\naGVsbG8=\n/);
                expect(pem).toMatch(/-----END PUBLIC KEY-----$/);
            });
        });

        describe('formatPrivatePEMKey()', () => {
            it('should include the private key header and footer', () => {
                const val = 'hello';
                const buffer = Buffer.from(val);
                const pem = formatPrivatePEMKey(buffer);

                expect(pem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
                expect(pem).toMatch(/\naGVsbG8=\n/);
                expect(pem).toMatch(/-----END PRIVATE KEY-----$/);
            });
        });

        describe('parsePrivatePEMKey()', () => {
            it('should parse the basic private key in PEM format', () => {
                const pem = `-----BEGIN PRIVATE KEY-----\naGVsbG8=\n-----END PRIVATE KEY-----`;
                const key = parsePrivatePEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });

            it('should parse the private key with extra whitespace', () => {
                const pem = ` -----BEGIN PRIVATE KEY-----\naGVsbG8=\n-----END PRIVATE KEY-----\n`;
                const key = parsePrivatePEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });
        });

        describe('parsePublicPEMKey()', () => {
            it('should parse the basic public key in PEM format', () => {
                const pem = `-----BEGIN PUBLIC KEY-----\naGVsbG8=\n-----END PUBLIC KEY-----`;
                const key = parsePublicPEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });

            it('should parse the private key with extra whitespace', () => {
                const pem = ` -----BEGIN PUBLIC KEY-----\naGVsbG8=\n-----END PUBLIC KEY-----\n`;
                const key = parsePublicPEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });
        });
    });
});