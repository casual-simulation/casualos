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

    describe('validateDomainName()', () => {
        const noRecordCodes = ['ENODATA', 'ENOTFOUND'];

        it('should succeed when only the TXT record exists', async () => {
            resolveTxtMock.mockResolvedValue([[expectedTxt]]);
            resolveCnameMock.mockRejectedValue(dnsError('ENODATA'));

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(success());
        });

        it.each(noRecordCodes)(
            'should succeed when only the CNAME record exists (%s)',
            async (code) => {
                resolveTxtMock.mockRejectedValue(dnsError(code));
                resolveCnameMock.mockResolvedValue(['casualos.example.com']);

                const result = await validator.validateDomainName(
                    'app.example.com',
                    'key',
                    'casualos.example.com'
                );

                expect(result).toEqual(success());
            }
        );

        it('should succeed when both records exist', async () => {
            resolveTxtMock.mockResolvedValue([[expectedTxt]]);
            resolveCnameMock.mockResolvedValue(['casualos.example.com']);

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(success());
        });

        it.each(noRecordCodes)(
            'should return not_found when neither record exists (%s)',
            async (code) => {
                resolveTxtMock.mockRejectedValue(dnsError(code));
                resolveCnameMock.mockRejectedValue(dnsError(code));

                const result = await validator.validateDomainName(
                    'app.example.com',
                    'key',
                    'casualos.example.com'
                );

                expect(result).toEqual(
                    failure({
                        errorCode: 'not_found',
                        errorMessage:
                            'No DNS TXT or CNAME records were found for the domain name.',
                    })
                );
            }
        );

        it('should say which records are missing when the records do not match', async () => {
            resolveTxtMock.mockResolvedValue([['casualos-verification=wrong']]);
            resolveCnameMock.mockRejectedValue(dnsError('ENODATA'));

            const result = await validator.validateDomainName(
                'app.example.com',
                'key',
                'casualos.example.com'
            );

            expect(result).toEqual(
                failure({
                    errorCode: 'not_found',
                    errorMessage:
                        'No DNS CNAME records were found for the domain name, and the TXT records do not contain the expected verification value.',
                })
            );
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
