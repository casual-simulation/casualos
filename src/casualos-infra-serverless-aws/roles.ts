import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as apigateway from '@pulumi/aws-apigateway';
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
