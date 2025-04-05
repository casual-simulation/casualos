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
import * as awsNative from '@pulumi/aws-native';
import { filesBucket } from '../../helpers';
import { WebsocketsComponent } from './WebsocketsComponent';
import { ApiComponent } from './ApiComponent';
import { SavePermanentBranchesComponent } from './SavePermanentBranchesComponent';
import { ScheduleModerationScansComponent } from './ScheduleModerationScansComponent';

export interface CasualOSInputs {
    /**
     * The files that should be used for the lambda functions.
     */
    archive: pulumi.Input<pulumi.asset.Archive>;

    /**
     * The list of allowed HTTP origins for the account endpoints of the API.
     */
    allowedOrigins: pulumi.Input<string>;

    /**
     * The list of allowed HTTP origins for the api endpoints of the API.
     */
    allowedApiOrigins: pulumi.Input<string>;

    /**
     * The storage class that should be used for file records.
     */
    filesStorageClass?: pulumi.Input<string>;

    /**
     * The name of the SES identity to use for sending emails.
     * If omitted, then SES permissions will not be added.
     */
    sesIdentityName?: pulumi.Input<string>;

    /**
     * The schedule that the function should be called at.
     * If omitted, then "rate(1 minute)" will be used.
     *
     * See https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html
     * for more info about the types of schedules.
     */
    moderationJobScheduleExpression?: pulumi.Input<string>;

    /**
     * The priority of the moderation job.
     */
    moderationJobPriority?: pulumi.Input<string>;

    /**
     * The version of the moderation project.
     */
    moderationJobProjectVersion?: pulumi.Input<string>;
}

/**
 * Defines a component that deploys the entire CasualOS backend using AWS Serverless resources.
 */
export class CasualOSComponent extends pulumi.ComponentResource {
    /**
     * The S3 bucket that should be used for storing files.
     */
    filesBucket: awsNative.s3.Bucket;

    /**
     * The component that is responsible for handling the websockets.
     */
    websockets: WebsocketsComponent;

    /**
     * The component that is responsible for handling the API.
     */
    api: ApiComponent;

    /**
     * The component that is responsible for saving permanent branches.
     */
    savePermanentBranches: SavePermanentBranchesComponent;

    /**
     * The component that is responsible for scheduling moderation scans.
     */
    scheduleModerationScans: ScheduleModerationScansComponent;

    /**
     * The bucket that stores moderation job reports.
     */
    moderationJobReportBucket: awsNative.s3.Bucket;

    constructor(
        name: string,
        inputs: CasualOSInputs,
        options?: pulumi.ResourceOptions
    ) {
        super(
            'casualos-infra:aws:serverless:CasualOSComponent',
            name,
            {},
            options
        );

        this.filesBucket = filesBucket('filesBucket', { parent: this });

        const {
            allowedOrigins,
            allowedApiOrigins,
            filesStorageClass,
            sesIdentityName,
            moderationJobScheduleExpression,
            moderationJobPriority,
            moderationJobProjectVersion,
        } = inputs;

        this.websockets = new WebsocketsComponent(
            'websockets',
            {
                allowedOrigins: allowedOrigins,
                allowedApiOrigins: allowedApiOrigins,
                filesBucket: this.filesBucket,
                websocketsCode: inputs.archive,
                filesStorageClass,
            },
            { parent: this }
        );

        this.api = new ApiComponent(
            'api',
            {
                allowedOrigins,
                allowedApiOrigins,
                filesBucket: this.filesBucket,
                recordsCode: inputs.archive,
                filesStorageClass,
                messagesBucket: this.websockets.messagesBucket.bucketName.apply(
                    (name) => name!
                ),
                sesIdentityName,
                websocketUrl: this.websockets.websocketsApi.apiEndpoint,
            },
            { parent: this }
        );

        this.savePermanentBranches = new SavePermanentBranchesComponent(
            'savePermanentBranches',
            {
                functionEnvironment: {
                    allowedOrigins,
                    allowedApiOrigins,
                    filesBucket: this.filesBucket.bucketName.apply(
                        (name) => name!
                    ),
                    filesStorageClass,
                    messagesBucket:
                        this.websockets.messagesBucket.bucketName.apply(
                            (name) => name!
                        ),
                    websocketUrl: this.websockets.websocketsApi.apiEndpoint,
                },
                scheduleExpression: 'rate(1 minute)',
                sesIdentityName,
                code: inputs.archive,
            },
            { parent: this }
        );

        this.moderationJobReportBucket = new awsNative.s3.Bucket(
            'moderationJobReportBucket',
            {},
            { retainOnDelete: true, deleteBeforeReplace: false, parent: this }
        );

        this.scheduleModerationScans = new ScheduleModerationScansComponent(
            'scheduleModerationScans',
            {
                functionEnvironment: {
                    allowedOrigins,
                    allowedApiOrigins,
                    filesBucket: this.filesBucket.bucketName.apply(
                        (name) => name!
                    ),
                    filesStorageClass,
                    messagesBucket:
                        this.websockets.messagesBucket.bucketName.apply(
                            (name) => name!
                        ),
                    websocketUrl: this.websockets.websocketsApi.apiEndpoint,
                },
                functionArn: this.api.handleRecordsFunction.arn,
                moderationJobReportBucket:
                    this.moderationJobReportBucket.bucketName.apply(
                        (name) => name!
                    ),
                code: inputs.archive,
                scheduleExpression: moderationJobScheduleExpression,
                sesIdentityName,
                jobPriority: moderationJobPriority,
                jobProjectVersion: moderationJobProjectVersion,
            },
            { parent: this }
        );
    }
}
