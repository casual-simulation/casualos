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
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
    WebhookEnvironment,
} from '@casual-simulation/aux-records';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { HandleWebhookPayload } from './LambdaWebhookPayload';
import { HANDLE_WEBHOOK_RESULT_SCHEMA } from './LambdaWebhookPayload';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { AuxConfigParameters } from '@casual-simulation/aux-vm';

const TRACE_NAME = 'LambdaWebhookEnvironment';

export interface LambdaWebhookEnvironmentOptions {
    /**
     * The name of the lambda function that should be used to run the webhooks.
     *
     * This can be the name of the function, or the ARN of the function that should be called.
     *
     * If omitted, then the WEBHOOK_LAMBDA_FUNCTION_NAME environment variable will be used.
     */
    functionName?: string | null;
}

/**
 * Defines a webhook environment that is able to run webhooks in the specified lambda function.
 */
export class LambdaWebhookEnvironment implements WebhookEnvironment {
    private _lambda: LambdaClient;
    private _functionName: string;
    private _configParameters: Partial<AuxConfigParameters>;

    constructor(
        options: LambdaWebhookEnvironmentOptions,
        configParameters: Partial<AuxConfigParameters>
    ) {
        this._lambda = new LambdaClient({});
        this._functionName = options.functionName;
        this._configParameters = configParameters;
        if (
            !this._functionName &&
            typeof process === 'object' &&
            process.env.WEBHOOK_LAMBDA_FUNCTION_NAME
        ) {
            this._functionName = process.env.WEBHOOK_LAMBDA_FUNCTION_NAME;
        }
    }

    @traced(TRACE_NAME)
    async handleHttpRequest(
        request: HandleHttpRequestRequest
    ): Promise<HandleHttpRequestResult> {
        const payload: HandleWebhookPayload = {
            recordName: request.recordName,
            inst: request.inst,
            state: request.state,
            request: request.request,
            requestUserId: request.requestUserId,
            sessionUserId: request.sessionUserId,
            sessionKey: request.sessionKey,
            connectionKey: request.connectionKey,
            options: request.options,
            configParameters: this._configParameters,
        };
        const command = new InvokeCommand({
            FunctionName: this._functionName,
            InvocationType: 'RequestResponse',
            LogType: 'None',
            Payload: JSON.stringify(payload),
        });

        const result = await this._lambda.send(command);

        if (result.FunctionError) {
            console.error(
                '[LambdaWebhookEnvironment] Lambda returned an error:',
                result
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage:
                    'An unknown error occurred while processing the webhook.',
            };
        }

        if (!result.Payload) {
            console.error(
                '[LambdaWebhookEnvironment] Lambda did not return a payload:',
                result
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage:
                    'An unknown error occurred while processing the webhook.',
            };
        }

        const json = result.Payload.transformToString('utf-8');
        const data = JSON.parse(json);
        const parseResult = HANDLE_WEBHOOK_RESULT_SCHEMA.safeParse(data);

        if (parseResult.success === true) {
            return parseResult.data as HandleHttpRequestResult;
        }

        console.error(
            '[LambdaWebhookEnvironment] Error parsing result from Lambda:',
            parseResult.error
        );
        return {
            success: false,
            errorCode: 'server_error',
            errorMessage:
                'An unknown error occurred while processing the webhook.',
        };
    }
}
