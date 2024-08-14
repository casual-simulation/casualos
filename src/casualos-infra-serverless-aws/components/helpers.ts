import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsNative from '@pulumi/aws-native';
/**
 * Creates a new S3 bucket with the configuration needed for storing large websocket messages.
 * @param name The name of the bucket.
 */
export function messagesBucket(name: string, options?: pulumi.ResourceOptions) {
    const bucket = new awsNative.s3.Bucket(
        name,
        {
            accessControl: 'Private',
            lifecycleConfiguration: {
                rules: [
                    {
                        id: 'CleanupRule',
                        prefix: '',
                        status: 'Enabled',
                        expirationInDays: 1,
                    },
                ],
            },
            corsConfiguration: {
                corsRules: [
                    {
                        id: 'AllowReadWriteCorsRule',
                        allowedMethods: ['GET', 'PUT'],
                        allowedOrigins: ['*'],
                        allowedHeaders: ['*'],
                        maxAge: 3600,
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
        options
    );

    const bucketPolicy = new awsNative.s3.BucketPolicy(
        `${name}Policy`,
        {
            bucket: bucket.bucketName.apply((n) => n!),
            policyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: '*',
                        Action: ['s3:GetObject'],
                        Resource: [pulumi.interpolate`${bucket.arn}/*`],
                    },
                ],
            },
        },
        options
    );

    return {
        bucket,
        bucketPolicy,
    };
}

/**
 * Creates a new S3 bucket with the configuration needed for storing files records.
 * @param name The name of the bucket.
 */
export function filesBucket(name: string, options?: pulumi.ResourceOptions) {
    return new awsNative.s3.Bucket(
        name,
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
        { retainOnDelete: true, deleteBeforeReplace: false, ...options }
    );
}

export interface FunctionEnvironmentInputs {
    filesBucket: pulumi.Input<string>;
    filesStorageClass?: pulumi.Input<string>;
    messagesBucket?: pulumi.Input<string>;
    websocketUrl?: pulumi.Input<string>;
    allowedOrigins: pulumi.Input<string>;
    allowedApiOrigins: pulumi.Input<string>;
}

/**
 * Gets the environment variables that should be used for functions that handle records.
 * @param inputs
 * @returns
 */
export function functionEnvironmentVariables(
    inputs: FunctionEnvironmentInputs
): aws.lambda.FunctionArgs['environment'] {
    let variables: Record<string, pulumi.Input<string>> = {
        REGION: aws.config.region ?? 'us-east-1',
        FILES_BUCKET: inputs.filesBucket,
        FILES_STORAGE_CLASS: inputs.filesStorageClass ?? 'STANDARD',
        ALLOWED_ORIGINS: inputs.allowedOrigins,
        ALLOWED_API_ORIGINS: inputs.allowedApiOrigins,
    };

    if (inputs.messagesBucket) {
        variables['MESSAGES_BUCKET'] = inputs.messagesBucket;
    }

    if (inputs.websocketUrl) {
        variables['WEBSOCKET_URL'] = inputs.websocketUrl;
    }

    return {
        variables: variables,
    };
}
