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
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { s3CrudPolicy } from './policies';

export interface ExecutionRoleInputs {
    messagesBucket: pulumi.Input<string>;
    websocketsApi: aws.apigatewayv2.Api;
}

/**
 * Creates a role that can be used to execute websockets functions.
 *
 * Grants the following permissions:
 * - s3CrudPolicy
 * - execute-api:ManageConnections
 *
 * @param name
 * @param inputs
 * @param options
 * @returns
 */
export function websocketsExecutionRole(
    name: string,
    inputs: ExecutionRoleInputs,
    options?: pulumi.ResourceOptions
) {
    return new aws.iam.Role(
        name,
        {
            assumeRolePolicy: pulumi.jsonStringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Action: 'sts:AssumeRole',
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com',
                        },
                    },
                ],
            }),
            inlinePolicies: [
                {
                    name: `websockets-s3-crud-policy`,
                    policy: s3CrudPolicy(inputs.messagesBucket),
                },
                {
                    name: `websockets-execute-api-policy`,
                    policy: pulumi.jsonStringify({
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Action: ['execute-api:ManageConnections'],
                                Effect: 'Allow',
                                Resource: [
                                    pulumi.interpolate`arn:aws:execute-api:*:*:${inputs.websocketsApi.id}/Prod/*/@connections/*`,
                                ],
                            },
                        ],
                    }),
                },
            ],
        },
        options
    );
}
