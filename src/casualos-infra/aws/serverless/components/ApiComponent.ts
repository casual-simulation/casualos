import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as apigateway from '@pulumi/aws-apigateway';
import * as awsNative from '@pulumi/aws-native';
import {
    rekognitionLabelsPolicy,
    s3CrudPolicy,
    sesCrudPolicy,
} from '../../policies';
import { functionEnvironmentVariables } from '../../helpers';

export interface ApiInputs {
    /**
     * The SES identity to allow the lambda function to send emails.
     * If omitted, then SES permissions will not be added.
     */
    sesIdentityName?: pulumi.Input<string>;

    /**
     * The AWS account ID to use for the SES identity.
     * If omitted, then the current account ID will be used.
     */
    accountId?: pulumi.Input<string>;

    /**
     * The AWS region to use for the SES identity.
     * If omitted, then the current region will be used.
     */
    region?: pulumi.Input<string>;

    /**
     * The code that should be included for the lambda function.
     */
    recordsCode: pulumi.Input<pulumi.asset.Archive>;

    /**
     * The bucket that should be used for storing file records.
     */
    filesBucket: awsNative.s3.Bucket;

    /**
     * The storage class to use for files records in the bucket.
     */
    filesStorageClass?: pulumi.Input<string>;

    /**
     * The allowed HTTP origins for the account endpoints of the function.
     */
    allowedOrigins: pulumi.Input<string>;

    /**
     * The allowed HTTP origins for the API endpoints of the function.
     */
    allowedApiOrigins: pulumi.Input<string>;

    /**
     * The URL that the API Gateway Websocket control API is available at.
     */
    websocketUrl?: pulumi.Input<string>;

    /**
     * The name of the bucket to use for storing large websocket messages.
     */
    messagesBucket?: pulumi.Input<string>;
}

/**
 * Defines a component that is able to setup the resources needed for the CasualOS HTTP API.
 * That is, serving the HTTP API of CasualOS.
 */
export class ApiComponent extends pulumi.ComponentResource {
    /**
     * The role that was created for the function.
     */
    handleRecordsRole: aws.iam.Role;

    /**
     * The function that was created for handling records.
     */
    handleRecordsFunction: aws.lambda.Function;

    /**
     * The log group that was created for the function.
     */
    handleRecordsLogGroup: aws.cloudwatch.LogGroup;

    /**
     * The rest API for the handle records function.
     */
    handleRecordsApi: apigateway.RestAPI;

    constructor(
        name: string,
        inputs: ApiInputs,
        options?: pulumi.ComponentResourceOptions
    ) {
        super('pkg:records:ApiComponent', name, {}, options);

        this.handleRecordsRole = new aws.iam.Role(
            'handleRecordsRole',
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
                        policy: s3CrudPolicy(
                            inputs.filesBucket.bucketName.apply((n) => n!)
                        ),
                    },
                    ...(inputs.sesIdentityName
                        ? [
                              {
                                  name: 'SESCrudPolicy',
                                  policy: sesCrudPolicy(
                                      'aws',
                                      inputs.region ??
                                          aws.config.requireRegion(),
                                      inputs.accountId ??
                                          aws.getCallerIdentityOutput().id,
                                      inputs.sesIdentityName
                                  ),
                              },
                          ]
                        : []),
                    {
                        name: 'RekognitionDetectLabels',
                        policy: rekognitionLabelsPolicy(),
                    },
                ],
            },
            { parent: this }
        );

        this.handleRecordsFunction = new aws.lambda.Function(
            'handleRecords',
            {
                handler: 'Records.handleRecords',
                code: inputs.recordsCode,
                runtime: 'nodejs18.x',
                memorySize: 256,
                timeout: 100,
                role: this.handleRecordsRole.arn,
                environment: functionEnvironmentVariables({
                    allowedApiOrigins: inputs.allowedApiOrigins,
                    allowedOrigins: inputs.allowedOrigins,
                    filesBucket: inputs.filesBucket.bucketName.apply((n) => n!),
                    filesStorageClass: inputs.filesStorageClass,
                    messagesBucket: inputs.messagesBucket,
                    websocketUrl: inputs.websocketUrl,
                }),
            },
            { parent: this }
        );

        this.handleRecordsLogGroup = new aws.cloudwatch.LogGroup(
            'handleRecordsLogGroup',
            {
                name: pulumi.interpolate`/aws/lambda/${this.handleRecordsFunction.name}`,
                retentionInDays: 14,
            },
            { parent: this }
        );

        this.handleRecordsApi = new apigateway.RestAPI(
            'handleRecordsApi',
            {
                routes: [
                    {
                        path: '/api/v2/{extra+}',
                        method: 'ANY',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '/api/v3/{extra+}',
                        method: 'ANY',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '/api/{userId}/metadata',
                        method: 'GET',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '/api/{userId}/metadata',
                        method: 'PUT',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '/api/{userId}/subscription',
                        method: 'GET',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '/api/{userId}/subscription/manage',
                        method: 'POST',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '/api/stripeWebhook',
                        method: 'POST',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '/instData',
                        method: 'GET',
                        eventHandler: this.handleRecordsFunction,
                    },
                    {
                        path: '*',
                        method: 'OPTIONS',
                        eventHandler: this.handleRecordsFunction,
                    },
                ],
                description: 'The API for the handleRecords function.',
            },
            { parent: this }
        );
    }
}
