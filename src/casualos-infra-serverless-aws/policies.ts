import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as apigateway from '@pulumi/aws-apigateway';

/**
 * Creates a new inline IAM policy that grants CRUD access to an S3 bucket.
 *
 * Grants the following permissions:
 * - s3:GetObject
 * - s3:ListBucket
 * - s3:GetBucketLocation
 * - s3:GetObjectVersion
 * - s3:PutObject
 * - s3:PutObjectAcl
 * - s3:GetLifecycleConfiguration
 * - s3:PutLifecycleConfiguration
 * - s3:DeleteObject
 *
 * @param bucketName The name of the bucket to grant access to.
 */
export function s3CrudPolicy(bucketName: pulumi.Input<string>) {
    return pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: [
                    's3:GetObject',
                    's3:ListBucket',
                    's3:GetBucketLocation',
                    's3:GetObjectVersion',
                    's3:PutObject',
                    's3:PutObjectAcl',
                    's3:GetLifecycleConfiguration',
                    's3:PutLifecycleConfiguration',
                    's3:DeleteObject',
                ],
                Resource: [
                    pulumi.interpolate`arn:aws:s3:::${bucketName}/*`,
                    pulumi.interpolate`arn:aws:s3:::${bucketName}`,
                ],
            },
        ],
    });
}

/**
 * Creates a new inline IAM policy that grants CRUD access to an S3 bucket.
 *
 * Grants the following permissions:
 *
 * - ses:GetIdentityVerificationAttributes
 * - ses:SendEmail
 * - ses:SendRawEmail
 * - ses:VerifyEmailIdentity
 *
 * @param awsPartition The AWS partition to use.
 * @param awsRegion The AWS region.
 * @param awsAccountId The AWS Account ID.
 * @param identityName The SES identity name.
 */
export function sesCrudPolicy(
    awsPartition: pulumi.Input<string>,
    awsRegion: pulumi.Input<string>,
    awsAccountId: pulumi.Input<string>,
    identityName: pulumi.Input<string>
) {
    return pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: [
                    'ses:GetIdentityVerificationAttributes',
                    'ses:SendEmail',
                    'ses:SendRawEmail',
                    'ses:VerifyEmailIdentity',
                ],
                Resource: pulumi.interpolate`arn:${awsPartition}:ses:${awsRegion}:${awsAccountId}:identity/${identityName}`,
            },
        ],
    });
}

/**
 * Creates a new inline IAM policy that grants access to AWS Rekognition.
 *
 * Grants the following permissions:
 *
 * - rekognition:DetectLabels
 * - rekognition:DetectModerationLabels
 *
 * @param awsPartition The AWS partition to use.
 * @param awsRegion The AWS region.
 * @param awsAccountId The AWS Account ID.
 * @param identityName The SES identity name.
 */
export function rekognitionLabelsPolicy() {
    return pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: [
                    'rekognition:DetectLabels',
                    'rekognition:DetectModerationLabels',
                ],
                Resource: '*',
            },
        ],
    });
}
