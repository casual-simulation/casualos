import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as apigateway from '@pulumi/aws-apigateway';
import * as awsNative from '@pulumi/aws-native';
import {
    rekognitionLabelsPolicy,
    s3CrudPolicy,
    sesCrudPolicy,
} from './policies';

export interface HandleRecordsInputs {
    sesIdentityName?: pulumi.Input<string>;
    accountId?: pulumi.Input<string>;
    region?: pulumi.Input<string>;
}

export class HandleRecordsComponent extends pulumi.ComponentResource {
    filesBucket: awsNative.s3.Bucket;

    handleRecordsRole: aws.iam.Role;
    handleRecordsFunction: aws.lambda.Function;

    constructor(
        name: string,
        inputs: HandleRecordsInputs,
        options: pulumi.ComponentResourceOptions
    ) {
        super('pkg:records:HandleRecordsComponent', name, {}, options);

        this.filesBucket = new awsNative.s3.Bucket(
            'filesBucket',
            {
                corsConfiguration: {
                    corsRules: [
                        {
                            allowedHeaders: ['*'],
                            allowedMethods: ['GET', 'PUT', 'POST'],
                            allowedOrigins: ['*'],
                            exposedHeaders: [],
                            maxAge: 3000,
                        },
                    ],
                },
                publicAccessBlockConfiguration: {
                    blockPublicAcls: false,
                    blockPublicPolicy: false,
                    ignorePublicAcls: false,
                    restrictPublicBuckets: false,
                },
                ownershipControls: {
                    rules: [
                        {
                            objectOwnership: 'BucketOwnerPreferred',
                        },
                    ],
                },
            },
            { retainOnDelete: true, deleteBeforeReplace: false, parent: this }
        );

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
                        name: '',
                        policy: s3CrudPolicy(
                            this.filesBucket.bucketName.apply((n) => n!)
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

        this.handleRecordsFunction = new aws.lambda.Function('handleRecords', {
            handler: 'Records.handleRecords',
            code: new pulumi.asset.FileArchive(
                '../aux-server/aux-backend/serverless/aws/dist/handlers'
            ),
            runtime: 'nodejs18.x',
            memorySize: 256,
            timeout: 100,
            role: this.handleRecordsRole.arn,
            environment: {
                variables: {
                    REGION: aws.config.region ?? 'us-east-1',
                    // FILES_BUCKET:
                },
            },
        });
    }
}
