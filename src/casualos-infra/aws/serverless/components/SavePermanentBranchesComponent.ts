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
import { s3CrudPolicy, sesCrudPolicy } from '../../policies';
import type { FunctionEnvironmentInputs } from '../../helpers';
import { functionEnvironmentVariables } from '../../helpers';

export interface SavePermanentBranchesInputs {
    /**
     * The aws region to use for the SES identity.
     */
    region?: pulumi.Input<string>;

    /**
     * The ID of the aws account.
     */
    accountId?: pulumi.Input<string>;

    /**
     * The options for the function environment.
     */
    functionEnvironment: FunctionEnvironmentInputs;

    /**
     * The code for the function.
     */
    code: pulumi.Input<pulumi.asset.Archive>;

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
}

/**
 * Defines a component that is able to save permanent branches to the database
 * using a lambda function that runs periodically.
 */
export class SavePermanentBranchesComponent extends pulumi.ComponentResource {
    /**
     * The role for the function.
     */
    role: aws.iam.Role;

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
        inputs: SavePermanentBranchesInputs,
        options?: pulumi.ComponentResourceOptions
    ) {
        super('pkg:records:SavePermanentBranchesComponent', name, {}, options);

        this.role = new aws.iam.Role(
            'role',
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
                        name: 's3CrudPolicy',
                        policy: s3CrudPolicy(
                            inputs.functionEnvironment.filesBucket
                        ),
                    },
                    ...(inputs.sesIdentityName
                        ? [
                              {
                                  name: 'sesCrudPolicy',
                                  policy: sesCrudPolicy(
                                      'aws',
                                      inputs.region ?? aws.config.region ?? '*',
                                      inputs.accountId ??
                                          aws
                                              .getCallerIdentity()
                                              .then((id) => id.accountId),
                                      inputs.sesIdentityName
                                  ),
                              },
                          ]
                        : []),
                ],
            },
            { parent: this }
        );

        this.function = new aws.lambda.Function(
            'function',
            {
                handler: 'Records.savePermanentBranches',
                runtime: 'nodejs18.x',
                memorySize: 1024,
                timeout: 900,
                description:
                    'A function that periodically saves all the permanent inst branches.',
                role: this.role.arn,
                environment: functionEnvironmentVariables(
                    inputs.functionEnvironment
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

        const scheduleExpression =
            inputs.scheduleExpression ?? 'rate(1 minute)';

        this.eventRule = new aws.cloudwatch.EventRule(
            'rule',
            {
                scheduleExpression,
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
