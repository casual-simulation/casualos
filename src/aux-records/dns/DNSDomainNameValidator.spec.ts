/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { failure, success } from '@casual-simulation/aux-common';
import { DNSDomainNameValidator } from './DNSDomainNameValidator';
import dns from 'node:dns/promises';

jest.mock('node:dns/promises', () => ({
    __esModule: true,
    default: {
        resolveTxt: jest.fn(),
        resolveCname: jest.fn(),
    },
}));

const resolveTxtMock = dns.resolveTxt as jest.Mock;
const resolveCnameMock = dns.resolveCname as jest.Mock;

function dnsError(code: string) {
    const err = new Error(`queryTxt ${code} example.com`) as any;
    err.code = code;
    return err;
}

/**
 * Mocks resolveTxt so that it returns the given records for each host name.
 * Host names that are not in the map fail with ENOTFOUND.
 */
function mockTxtRecords(records: Record<string, string[][] | Error>) {
    resolveTxtMock.mockImplementation(async (name: string) => {
        const value = records[name];
        if (!value) {
            throw dnsError('ENOTFOUND');
        }
        if (value instanceof Error) {
            throw value;
        }
        return value;
    });
}

describe('DNSDomainNameValidator', () => {
    let validator: DNSDomainNameValidator;
    let expectedTxt: string;

    beforeEach(async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        resolveTxtMock.mockReset();
        resolveCnameMock.mockReset();
        validator = new DNSDomainNameValidator();

        const records = await validator.getVerificationDNSRecord(
            'app.example.com',
            'key',
            'casualos.example.com'
        );
        if (records.success === false) {
            throw new Error('Unable to get records');
        }
        expectedTxt = records.value[0].value;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getVerificationDNSRecord()', () => {
        it('should return a TXT verification record on its own name and a CNAME routing record', async () => {
            const result = await validator.getVerificationDNSRecord(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(
                success([
                    {
                        recordType: 'TXT',
                        name: '_casualos-verification.app.example.com',
                        value: expect.stringMatching(
                            /^casualos-verification=[0-9a-f]{64}$/
                        ),
                        ttlSeconds: 32600,
                        purpose: 'verification',
                    },
                    {
                        recordType: 'CNAME',
                        name: 'app.example.com',
                        value: 'casualos.example.com',
                        ttlSeconds: 32600,
                        purpose: 'routing',
                    },
                ])
            );
        });

        it('should produce a different TXT value for a different verification key', async () => {
            const other = await validator.getVerificationDNSRecord(
                'app.example.com',
                'other-key',
                'casualos.example.com'
            );
            if (other.success === false) {
                throw new Error('Unable to get records');
            }
            expect(other.value[0].value).not.toEqual(expectedTxt);
        });
    });

    describe('validateDomainName()', () => {
        it('should succeed when the TXT record exists on the verification name', async () => {
            mockTxtRecords({
                '_casualos-verification.app.example.com': [[expectedTxt]],
            });

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(success());
            expect(resolveTxtMock).toHaveBeenCalledWith(
                '_casualos-verification.app.example.com'
            );
        });

        it('should succeed when the TXT record exists on the domain itself', async () => {
            mockTxtRecords({
                'app.example.com': [[expectedTxt]],
            });

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(success());
        });

        it('should fail when only the CNAME record exists', async () => {
            mockTxtRecords({});
            resolveCnameMock.mockResolvedValue(['casualos.example.com']);

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(
                failure({
                    errorCode: 'not_found',
                    errorMessage:
                        'No DNS TXT verification record was found on _casualos-verification.app.example.com.',
                })
            );
        });

        it.each(['ENODATA', 'ENOTFOUND'])(
            'should return not_found when no TXT records exist (%s)',
            async (code) => {
                resolveTxtMock.mockRejectedValue(dnsError(code));

                const result = await validator.validateDomainName(
                    'app.example.com',
                    'key',
                    'casualos.example.com'
                );

                expect(result).toEqual(
                    failure({
                        errorCode: 'not_found',
                        errorMessage:
                            'No DNS TXT verification record was found on _casualos-verification.app.example.com.',
                    })
                );
            }
        );

        it('should fail when the TXT record was generated with a different verification key', async () => {
            const other = await validator.getVerificationDNSRecord(
                'app.example.com',
                'other-studio-key',
                'casualos.example.com'
            );
            if (other.success === false) {
                throw new Error('Unable to get records');
            }
            mockTxtRecords({
                '_casualos-verification.app.example.com': [
                    [other.value[0].value],
                ],
            });

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(
                failure({
                    errorCode: 'not_found',
                    errorMessage:
                        'The DNS TXT record on _casualos-verification.app.example.com does not contain the expected verification value.',
                })
            );
        });

        it('should ignore TXT records that are not verification records', async () => {
            mockTxtRecords({
                '_casualos-verification.app.example.com': [
                    ['v=spf1 include:example.com ~all'],
                    ['other', expectedTxt],
                ],
            });

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(success());
        });

        it('should rethrow other DNS errors', async () => {
            resolveTxtMock.mockRejectedValue(dnsError('ETIMEOUT'));

            await expect(
                validator.validateDomainName(
                    'app.example.com',
                    'key',
                    'casualos.example.com'
                )
            ).rejects.toThrow('ETIMEOUT');
        });
    });
});
