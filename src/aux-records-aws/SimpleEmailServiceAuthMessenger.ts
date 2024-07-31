import {
    AuthMessenger,
    SendCodeResult,
} from '@casual-simulation/aux-records/AuthMessenger';
import { AddressType } from '@casual-simulation/aux-records/AuthStore';
import { SESv2, EmailContent as SESEmailContent } from '@aws-sdk/client-sesv2';
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
        /\{\{[^\{\}]+\}\}/g,
        (match) => obj[match.substring(2, match.length - 2)]
    );
}
