import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as apigateway from '@pulumi/aws-apigateway';
import * as awsNative from '@pulumi/aws-native';

import { filesBucket } from './components/helpers';
import { WebsocketsComponent } from './components/WebsocketsComponent';
import { ApiComponent } from './components/ApiComponent';
import { SavePermanentBranchesComponent } from './components/SavePermanentBranchesComponent';
import { ScheduleModerationScansComponent } from './components/ScheduleModerationScansComponent';

let config = new pulumi.Config();
const sesIdentityName = config.get('sesIdentityName');
const allowedOrigins = config.require('allowedOrigins');
const allowedApiOrigins = config.require('allowedApiOrigins');
const filesStorageClass = config.get('filesStorageClass');
const moderationJobSchedule = config.get('moderationJobSchedule');
const moderationJobPriority = config.get('moderationJobPriority');
const moderationJobProjectVersion = config.get('moderationJobProjectVersion');

const files = filesBucket('filesBucket');

const archive = new pulumi.asset.FileArchive(
    '../aux-server/aux-backend/serverless/aws/dist/handlers'
);

const websockets = new WebsocketsComponent('websockets', {
    allowedOrigins: allowedOrigins,
    allowedApiOrigins: allowedApiOrigins,
    filesBucket: files,
    websocketsCode: archive,
    filesStorageClass,
});

const api = new ApiComponent('api', {
    allowedOrigins,
    allowedApiOrigins,
    filesBucket: files,
    recordsCode: archive,
    filesStorageClass,
    messagesBucket: websockets.messagesBucket.bucketName.apply((name) => name!),
    sesIdentityName,
    websocketUrl: websockets.websocketsApi.apiEndpoint,
});

const savePermanentBranches = new SavePermanentBranchesComponent(
    'savePermanentBranches',
    {
        functionEnvironment: {
            allowedOrigins,
            allowedApiOrigins,
            filesBucket: files.bucketName.apply((name) => name!),
            filesStorageClass,
            messagesBucket: websockets.messagesBucket.bucketName.apply(
                (name) => name!
            ),
            websocketUrl: websockets.websocketsApi.apiEndpoint,
        },
        scheduleExpression: 'rate(1 minute)',
        sesIdentityName,
        code: archive,
    }
);

const moderationJobReportBucket = new awsNative.s3.Bucket(
    'moderationJobReportBucket',
    {},
    { retainOnDelete: true, deleteBeforeReplace: false }
);

const scheduleModerationScans = new ScheduleModerationScansComponent(
    'scheduleModerationScans',
    {
        functionEnvironment: {
            allowedOrigins,
            allowedApiOrigins,
            filesBucket: files.bucketName.apply((name) => name!),
            filesStorageClass,
            messagesBucket: websockets.messagesBucket.bucketName.apply(
                (name) => name!
            ),
            websocketUrl: websockets.websocketsApi.apiEndpoint,
        },
        functionArn: api.handleRecordsFunction.arn,
        moderationJobReportBucket: moderationJobReportBucket.bucketName.apply(
            (name) => name!
        ),
        code: archive,
        scheduleExpression: moderationJobSchedule,
        sesIdentityName,
        jobPriority: moderationJobPriority,
        jobProjectVersion: moderationJobProjectVersion,
    }
);
