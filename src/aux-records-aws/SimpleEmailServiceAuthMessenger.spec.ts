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
import {
    SimpleEmailServiceAuthMessenger,
    renderString,
} from './SimpleEmailServiceAuthMessenger';
import { awsResult } from './AwsTestUtils';

describe('SimpleEmailServiceAuthMessenger', () => {
    let messenger: SimpleEmailServiceAuthMessenger;
    let ses = {
        sendEmail: jest.fn(),
    };

    beforeEach(() => {
        ses = {
            sendEmail: jest.fn(),
        };
        messenger = new SimpleEmailServiceAuthMessenger(ses as any, {
            content: {
                type: 'plain',
                subject: 'Test',
                body: 'Your code is: {{code}}',
            },
            fromAddress: 'test@example.com',
        });
    });

    describe('supportsAddressType()', () => {
        it('should return true for email', async () => {
            expect(await messenger.supportsAddressType('email')).toBe(true);
        });

        it('should return false for phone', async () => {
            expect(await messenger.supportsAddressType('phone')).toBe(false);
        });

        it('should return false for other', async () => {
            expect(await messenger.supportsAddressType('other' as any)).toBe(
                false
            );
        });
    });

    describe('sendCode()', () => {
        it('should send a code using the simple template', async () => {
            messenger = new SimpleEmailServiceAuthMessenger(ses as any, {
                content: {
                    type: 'plain',
                    subject: 'Test',
                    body: 'Your code is: {{code}}',
                },
                fromAddress: 'test@example.com',
            });

            ses.sendEmail.mockReturnValueOnce(
                awsResult({
                    MessageId: 'test',
                })
            );

            const result = await messenger.sendCode(
                'target@example.com',
                'email',
                '1234'
            );

            expect(result).toEqual({
                success: true,
            });
            expect(ses.sendEmail).toBeCalledWith({
                Destination: {
                    ToAddresses: ['target@example.com'],
                },
                FromEmailAddress: 'test@example.com',
                Content: {
                    Simple: {
                        Body: {
                            Text: {
                                Data: 'Your code is: 1234',
                                Charset: 'UTF-8',
                            },
                        },
                        Subject: {
                            Data: 'Test',
                            Charset: 'UTF-8',
                        },
                    },
                },
            });
        });

        it('should send a code using the given AWS template', async () => {
            messenger = new SimpleEmailServiceAuthMessenger(ses as any, {
                content: {
                    type: 'template',
                    templateArn: 'test-arn',
                },
                fromAddress: 'test@example.com',
            });

            ses.sendEmail.mockReturnValueOnce(
                awsResult({
                    MessageId: 'test',
                })
            );

            const result = await messenger.sendCode(
                'target@example.com',
                'email',
                '1234'
            );

            expect(result).toEqual({
                success: true,
            });
            expect(ses.sendEmail).toBeCalledWith({
                Destination: {
                    ToAddresses: ['target@example.com'],
                },
                FromEmailAddress: 'test@example.com',
                Content: {
                    Template: {
                        TemplateArn: 'test-arn',
                        TemplateData: JSON.stringify({
                            code: '1234',
                            address: 'target@example.com',
                            addressType: 'email',
                        }),
                    },
                },
            });
        });
    });
});

describe('renderString()', () => {
    const cases = [
        ['Hello, {{name}}!', { name: 'Bob' }, 'Hello, Bob!'] as const,
        [
            '{{num1}} + {{num2}} = {{num3}}',
            { num1: 1, num2: 2, num3: 3 },
            '1 + 2 = 3',
        ] as const,
        [
            '{{num1}} + {{num1}} = {{num2}}',
            { num1: 1, num2: 2 },
            '1 + 1 = 2',
        ] as const,
    ];

    it.each(cases)('should render %s', (template, data, expected) => {
        expect(renderString(template, data)).toBe(expected);
    });
});
