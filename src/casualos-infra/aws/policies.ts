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

export interface AttachLogsPolicyInputs {
    /**
     * The function that should be allowed to write logs.
     */
    function: aws.lambda.Function;

    /**
     * The region that is in use.
     */
    region?: pulumi.Input<string>;

    /**
     * The account ID that is in use.
     */
    accountId?: pulumi.Input<string>;
}

/**
 * Attaches the a policy that allows a function to write logs to CloudWatch.
 *
 * Grants the following permissions:
 * - logs:CreateLogStream
 * - logs:CreateLogGroup
 * - logs:PutLogEvents
 *
 * @param name The name of the resources.
 * @param inputs The inputs for the resources.
 * @param options The options for the resources.
 */
export function attachLogsPolicy(
    name: string,
    inputs: AttachLogsPolicyInputs,
    options?: pulumi.ResourceOptions
) {
    const region = inputs.region ?? aws.config.region;
    const accountId =
        inputs.accountId ?? aws.getCallerIdentityOutput().accountId;
    const functionName = inputs.function.name;
    const policy = new aws.iam.Policy(
        `${name}LogsPolicy`,
        {
            policy: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Action: [
                            'logs:CreateLogStream',
                            'logs:CreateLogGroup',
                            'logs:PutLogEvents',
                        ],
                        Effect: 'Allow',
                        Resource: [
                            pulumi.interpolate`arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${functionName}:*`,
                            pulumi.interpolate`arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${functionName}:*:*`,
                        ],
                    },
                ],
            },
        },
        options
    );

    const attachment = new aws.iam.RolePolicyAttachment(
        `${name}LogsPolicyAttachment`,
        {
            policyArn: policy.arn,
            role: inputs.function.role,
        },
        options
    );

    return {
        policy,
        attachment,
    };
}
