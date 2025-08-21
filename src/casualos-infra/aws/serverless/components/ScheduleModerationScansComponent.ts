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
import type { FunctionEnvironmentInputs } from '../../helpers';
import {
    functionEnvironmentVariables,
    moderationEnvironmentVariables,
} from '../../helpers';
import { merge } from 'es-toolkit/compat';

export interface ScheduleModerationScansInputs {
    /**
     * The aws region to use for the SES identity.
     */
    region?: pulumi.Input<string>;

    /**
     * The ID of the aws account.
     */
    accountId?: pulumi.Input<string>;

    /**
     * The ARN of the lambda function that should be called to
     * perform the moderation scans.
     */
    functionArn: pulumi.Input<string>;

    /**
     * The options for the function environment.
     */
    functionEnvironment: FunctionEnvironmentInputs;

    /**
     * The code for the function.
     */
    code: pulumi.Input<pulumi.asset.Archive>;

    /**
     * The name of the bucket that the moderation job reports should be saved to.
     */
    moderationJobReportBucket: pulumi.Input<string>;

    /**
     * The schedule that the function should be called at.
     * If omitted, then "rate(1 minute)" will be used.
     *
     * See https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html
     * for more info about the types of schedules.
     */
    scheduleExpression?: pulumi.Input<string>;

    /**
     * The SES identity to allow the lambda function to send emails.
     * If omitted, then SES permissions will not be added.
     */
    sesIdentityName?: pulumi.Input<string>;

    /**
     * The priority of the moderation job.
     */
    jobPriority?: pulumi.Input<string>;

    /**
     * The version of the project.
     */
    jobProjectVersion?: pulumi.Input<string>;
}

/**
 * Defines a component that is able to schedule file moderation scans
 * using a lambda function that runs periodically.
 */
export class ScheduleModerationScansComponent extends pulumi.ComponentResource {
    /**
     * The role used to scan the bucket.
     */
    scanRole: aws.iam.Role;

    /**
     * The role for the function.
     */
    functionRole: aws.iam.Role;

    /**
     * The function that was created for saving permanent branches.
     */
    function: aws.lambda.Function;

    /**
     * The log group that was created for the function.
     */
    logGroup: aws.cloudwatch.LogGroup;

    /**
     * The event rule that was created for the function.
     */
    eventRule: aws.cloudwatch.EventRule;

    /**
     * The event target that was created for the function.
     */
    eventTarget: aws.cloudwatch.EventTarget;

    constructor(
        name: string,
        inputs: ScheduleModerationScansInputs,
        options?: pulumi.ComponentResourceOptions
    ) {
        super(
            'pkg:records:ScheduleModerationScansComponent',
            name,
            {},
            options
        );

        this.scanRole = new aws.iam.Role(
            'scanRole',
            {
                assumeRolePolicy: {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Action: 'sts:AssumeRole',
                            Effect: 'Allow',
                            Principal: {
                                Service: 'batchoperations.s3.amazonaws.com',
                            },
                        },
                    ],
                },
                inlinePolicies: [
                    {
                        name: 'moderation-batch-scan-policy',
                        policy: pulumi.jsonStringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: [
                                        's3:GetObject',
                                        's3:GetObjectVersion',
                                        's3:PutObject',
                                        's3:ListBucket',
                                    ],
                                    Resource: [
                                        pulumi.interpolate`arn:aws:s3:::${inputs.functionEnvironment.filesBucket}/*`,
                                        pulumi.interpolate`arn:aws:s3:::${inputs.functionEnvironment.filesBucket}`,
                                        pulumi.interpolate`arn:aws:s3:::${inputs.moderationJobReportBucket}/*`,
                                        pulumi.interpolate`arn:aws:s3:::${inputs.moderationJobReportBucket}`,
                                    ],
                                },
                                {
                                    Effect: 'Allow',
                                    Action: ['lambda:InvokeFunction'],
                                    Resource: [inputs.functionArn],
                                },
                            ],
                        }),
                    },
                ],
            },
            { parent: this }
        );

        this.functionRole = new aws.iam.Role(
            'functionRole',
            {
                assumeRolePolicy: {
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
                },
                inlinePolicies: [
                    {
                        name: 'CreateBatchJob',
                        policy: pulumi.jsonStringify({
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Action: ['iam:PassRole'],
                                    Resource: [this.scanRole.arn],
                                },
                                {
                                    Effect: 'Allow',
                                    Action: ['s3:CreateJob'],
                                    Resource: '*',
                                },
                                {
                                    Effect: 'Allow',
                                    Action: ['s3:PutObject'],
                                    Resource: [
                                        pulumi.interpolate`arn:aws:s3:::${inputs.moderationJobReportBucket}/*`,
                                        pulumi.interpolate`arn:aws:s3:::${inputs.moderationJobReportBucket}`,
                                    ],
                                },
                            ],
                        }),
                    },
                ],
            },
            { parent: this }
        );

        this.function = new aws.lambda.Function(
            'function',
            {
                handler: 'Records.scheduleModerationScans',
                runtime: 'nodejs18.x',
                memorySize: 1024,
                timeout: 900,
                description:
                    'A function that periodically schedules moderation scans.',
                role: this.functionRole.arn,
                environment: merge(
                    functionEnvironmentVariables(inputs.functionEnvironment),
                    moderationEnvironmentVariables({
                        lambdaFunctionArn: inputs.functionArn,
                        roleArn: this.scanRole.arn,
                        reportBucket: inputs.moderationJobReportBucket,
                        accountId: inputs.accountId,
                        priority: inputs.jobPriority,
                        projectVersion: inputs.jobProjectVersion,
                    })
                ),
                code: inputs.code,
            },
            { parent: this }
        );

        this.logGroup = new aws.cloudwatch.LogGroup(
            'logGroup',
            {
                name: pulumi.interpolate`/aws/lambda/${this.function.name}`,
                retentionInDays: 14,
            },
            { parent: this }
        );

        this.eventRule = new aws.cloudwatch.EventRule(
            'rule',
            {
                scheduleExpression: inputs.scheduleExpression ?? 'rate(1 day)',
                state: inputs.scheduleExpression ? 'ENABLED' : 'DISABLED',
            },
            { parent: this }
        );

        this.eventTarget = new aws.cloudwatch.EventTarget(
            'target',
            {
                arn: this.function.arn,
                rule: this.eventRule.name,
            },
            { parent: this }
        );
    }
}
