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
import type {
    AuthMessenger,
    SendCodeResult,
} from '@casual-simulation/aux-records/AuthMessenger';
import type { AddressType } from '@casual-simulation/aux-records/AuthStore';
import type {
    SESv2,
    EmailContent as SESEmailContent,
} from '@aws-sdk/client-sesv2';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SimpleEmailServiceAuthMessenger';

export interface SimpleEmailServiceAuthMessengerOptions {
    /**
     * The address that the email is sent from.
     */
    fromAddress: string;

    /**
     * The content that the email should have.
     */
    content: EmailContent;
}

export type EmailContent = EmailTemplateContent | EmailPlainContent;

export interface EmailTemplateContent {
    type: 'template';
    templateArn: string;
}

export interface EmailPlainContent {
    type: 'plain';
    subject: string;
    body: string;
}

export class SimpleEmailServiceAuthMessenger implements AuthMessenger {
    private _ses: SESv2;
    private _options: SimpleEmailServiceAuthMessengerOptions;

    constructor(ses: SESv2, options: SimpleEmailServiceAuthMessengerOptions) {
        this._ses = ses;
        this._options = options;
    }

    @traced(TRACE_NAME)
    supportsAddressType(addressType: AddressType): Promise<boolean> {
        return Promise.resolve(addressType === 'email');
    }

    @traced(TRACE_NAME)
    async sendCode(
        address: string,
        addressType: AddressType,
        code: string
    ): Promise<SendCodeResult> {
        try {
            const data = {
                code: code,
                address: address,
                addressType: addressType,
            };
            let content: SESEmailContent;
            if (this._options.content.type === 'template') {
                content = {
                    Template: {
                        TemplateArn: this._options.content.templateArn,
                        TemplateData: JSON.stringify(data),
                    },
                };
            } else if (this._options.content.type === 'plain') {
                content = {
                    Simple: {
                        Body: {
                            Text: {
                                Data: renderString(
                                    this._options.content.body,
                                    data
                                ),
                                Charset: 'UTF-8',
                            },
                        },
                        Subject: {
                            Data: renderString(
                                this._options.content.subject,
                                data
                            ),
                            Charset: 'UTF-8',
                        },
                    },
                };
            } else {
                throw new Error(
                    'Unable to send email because the content type is not supported: ' +
                        (this._options.content as any).type
                );
            }

            await this._ses.sendEmail({
                Destination: {
                    ToAddresses: [address],
                },
                FromEmailAddress: this._options.fromAddress,
                Content: content,
            });

            return {
                success: true,
            };
        } catch (ex) {
            console.log(
                '[SimpleEmailServiceAuthMessenger] Error sending email: ' +
                    ex.message,
                ex
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

/**
 * Replaces all instances of {{key}} in the given string with the value of the key in the given object.
 * @param str The string to render.
 * @param obj The object that contains the values to render into the result string.
 */
export function renderString(str: string, obj: any): string {
    return str.replace(
        /\{\{[^{}]+\}\}/g,
        (match) => obj[match.substring(2, match.length - 2)]
    );
}
