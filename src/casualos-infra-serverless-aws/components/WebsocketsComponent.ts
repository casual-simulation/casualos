import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as apigateway from '@pulumi/aws-apigateway';
import * as awsNative from '@pulumi/aws-native';
import {} from '../policies';
import { attachLogsPolicy } from '../policies';
import { functionEnvironmentVariables, messagesBucket } from './helpers';
import { websocketsExecutionRole } from '../roles';

export interface WebsocketsInputs {
    /**
     * The bucket that is used for storing file records.
     */
    filesBucket: awsNative.s3.Bucket;

    /**
     * The storage class to use for files records in the bucket.
     */
    filesStorageClass?: pulumi.Input<string>;

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
     * The allowed HTTP origins for the account endpoints of the function.
     */
    allowedOrigins: pulumi.Input<string>;

    /**
     * The allowed HTTP origins for the API endpoints of the function.
     */
    allowedApiOrigins: pulumi.Input<string>;

    /**
     * The code that should be used for the websocket lambda functions.
     */
    websocketsCode: pulumi.Input<pulumi.asset.Archive>;
}

/**
 * Defines a component that is able to spin up the resources needed for the CasualOS Websockets API.
 */
export class WebsocketsComponent extends pulumi.ComponentResource {
    /**
     * The S3 bucket that was created for storing large websocket messages.
     */
    messagesBucket: awsNative.s3.Bucket;

    /**
     * The S3 bucket policy that was created for the messages bucket.
     */
    messagesBucketPolicy: awsNative.s3.BucketPolicy;

    /**
     * The API Gateway Websockets API that was created.
     */
    websocketsApi: aws.apigatewayv2.Api;

    /**
     * The role that is used to execute the connect functions.
     */
    connectRole: aws.iam.Role;

    /**
     * The function that is used to handle connect events.
     */
    handleConnectFunction: aws.lambda.Function;

    /**
     * The permission that is used to allow the API Gateway to invoke the connect function.
     */
    handleConnectPermission: aws.lambda.Permission;

    /**
     * The log group that is used to store logs for the connect function.
     */
    handleConnectLogGroup: aws.cloudwatch.LogGroup;

    handleConnectLogsPolicy: aws.iam.Policy;
    handleConnectLogsPolicyAttachment: aws.iam.RolePolicyAttachment;

    /**
     * The integration that is used to send connect events to the connect lambda function.
     */
    connectIntegration: aws.apigatewayv2.Integration;

    /**
     * The route that is used to send connect events to the connect lambda function.
     */
    connectRoute: aws.apigatewayv2.Route;

    /**
     * The role that is used to execute the disconnect functions.
     */
    disconnectRole: aws.iam.Role;

    /**
     * The function that is used to handle disconnect events.
     */
    handleDisconnectFunction: aws.lambda.Function;

    /**
     * The permission that is used to allow the API Gateway to invoke the disconnect function.
     */
    handleDisconnectPermission: aws.lambda.Permission;

    /**
     * The log group that is used to store logs for the disconnect function.
     */
    handleDisconnectLogGroup: aws.cloudwatch.LogGroup;

    /**
     * The integration that is used to send disconnect events to the disconnect lambda function.
     */
    disconnectIntegration: aws.apigatewayv2.Integration;

    /**
     * The route that is used to send disconnect events to the disconnect lambda function.
     */
    disconnectRoute: aws.apigatewayv2.Route;

    handleDisconnectLogsPolicy: aws.iam.Policy;
    handleDisconnectLogsPolicyAttachment: aws.iam.RolePolicyAttachment;

    /**
     * The role that is used to execute the message function.
     */
    messageRole: aws.iam.Role;

    /**
     * The function that is used to handle message events.
     */
    handleMessageFunction: aws.lambda.Function;

    /**
     * The permission that is used to allow the API Gateway to invoke the message function.
     */
    handleMessagePermission: aws.lambda.Permission;

    /**
     * The log group that is used to store logs for the message function.
     */
    handleMessageLogGroup: aws.cloudwatch.LogGroup;

    /**
     * The integration that is used to send message events to the message lambda function.
     */
    messageIntegration: aws.apigatewayv2.Integration;

    /**
     * The route that is used to send message events to the message lambda function.
     */
    messageRoute: aws.apigatewayv2.Route;

    handleMessageLogsPolicy: aws.iam.Policy;
    handleMessageLogsPolicyAttachment: aws.iam.RolePolicyAttachment;

    /**
     * The deployment for the gateway.
     */
    deployment: aws.apigatewayv2.Deployment;

    /**
     * The stage for the gateway.
     */
    stage: aws.apigatewayv2.Stage;

    constructor(
        name: string,
        inputs: WebsocketsInputs,
        options?: pulumi.ComponentResourceOptions
    ) {
        super('pkg:records:WebsocketsComponent', name, {}, options);

        const { bucket, bucketPolicy } = messagesBucket('messagesBucket', {
            parent: this,
        });
        this.messagesBucket = bucket;
        this.messagesBucketPolicy = bucketPolicy;

        this.websocketsApi = new aws.apigatewayv2.Api(
            'websocketsApi',
            {
                protocolType: 'WEBSOCKET',
                routeSelectionExpression: '$request.body.action',
            },
            { parent: this }
        );

        this.deployment = new aws.apigatewayv2.Deployment(
            'deployment',
            {
                apiId: this.websocketsApi.id,
            },
            { parent: this }
        );

        this.stage = new aws.apigatewayv2.Stage(
            'stage',
            {
                apiId: this.websocketsApi.id,
                deploymentId: this.deployment.id,
                name: 'Prod',
                description: 'Production Stage',
            },
            { parent: this }
        );

        const accountId =
            inputs.accountId ?? aws.getCallerIdentityOutput().accountId;
        const region = inputs.region ?? aws.config.region;

        this.connectRole = websocketsExecutionRole(
            'connectRole',
            {
                messagesBucket: this.messagesBucket.bucketName.apply((n) => n!),
                websocketsApi: this.websocketsApi,
            },
            { parent: this }
        );

        this.handleConnectFunction = new aws.lambda.Function(
            'handleConnect',
            {
                handler: 'websockets.connect',
                code: inputs.websocketsCode,
                runtime: 'nodejs18.x',
                memorySize: 256,
                timeout: 100,
                role: this.connectRole.arn,
                environment: functionEnvironmentVariables({
                    filesBucket: inputs.filesBucket.bucketName.apply((n) => n!),
                    filesStorageClass: inputs.filesStorageClass,
                    allowedOrigins: inputs.allowedOrigins,
                    allowedApiOrigins: inputs.allowedApiOrigins,
                    messagesBucket: this.messagesBucket.bucketName.apply(
                        (n) => n!
                    ),
                }),
            },
            { parent: this }
        );

        this.handleConnectPermission = new aws.lambda.Permission(
            'handleConnectPermission',
            {
                action: 'lambda:InvokeFunction',
                function: this.handleConnectFunction.name,
                principal: 'apigateway.amazonaws.com',
            },
            { parent: this }
        );

        this.handleConnectLogGroup = new aws.cloudwatch.LogGroup(
            'handleConnectLogGroup',
            {
                name: pulumi.interpolate`/aws/lambda/${this.handleConnectFunction.name}`,
                retentionInDays: 14,
            },
            { parent: this }
        );

        this.connectIntegration = new aws.apigatewayv2.Integration(
            'connectIntegration',
            {
                apiId: this.websocketsApi.id,
                integrationType: 'AWS_PROXY',
                description: 'Connect Integration',
                integrationUri: pulumi.interpolate`arn:aws:apigateway:${aws.config.region}:lambda:path/2015-03-31/functions/${this.handleConnectFunction.arn}/invocations`,
            },
            { parent: this }
        );

        this.connectRoute = new aws.apigatewayv2.Route(
            'connectRoute',
            {
                apiId: this.websocketsApi.id,
                routeKey: '$connect',
                authorizationType: 'NONE',
                operationName: 'ConnectRoute',
                target: pulumi.interpolate`integrations/${this.connectIntegration.id}`,
            },
            { parent: this }
        );

        const connectAttachment = attachLogsPolicy(
            'handleConnect',
            {
                function: this.handleConnectFunction,
                region: region,
                accountId: accountId,
            },
            { parent: this }
        );

        this.handleConnectLogsPolicy = connectAttachment.policy;
        this.handleConnectLogsPolicyAttachment = connectAttachment.attachment;

        this.disconnectRole = websocketsExecutionRole(
            'disconnectRole',
            {
                messagesBucket: this.messagesBucket.bucketName.apply((n) => n!),
                websocketsApi: this.websocketsApi,
            },
            { parent: this }
        );

        this.handleDisconnectFunction = new aws.lambda.Function(
            'handleDisconnect',
            {
                handler: 'websockets.disconnect',
                code: inputs.websocketsCode,
                runtime: 'nodejs18.x',
                memorySize: 256,
                timeout: 100,
                description:
                    'Description: A function that handles websocket disconnections.',
                role: this.disconnectRole.arn,
                environment: functionEnvironmentVariables({
                    filesBucket: inputs.filesBucket.bucketName.apply((n) => n!),
                    filesStorageClass: inputs.filesStorageClass,
                    allowedOrigins: inputs.allowedOrigins,
                    allowedApiOrigins: inputs.allowedApiOrigins,
                    messagesBucket: this.messagesBucket.bucketName.apply(
                        (n) => n!
                    ),
                }),
            },
            { parent: this }
        );

        this.handleDisconnectPermission = new aws.lambda.Permission(
            'handleDisconnectPermission',
            {
                action: 'lambda:InvokeFunction',
                function: this.handleDisconnectFunction.name,
                principal: 'apigateway.amazonaws.com',
            },
            { parent: this }
        );

        this.handleDisconnectLogGroup = new aws.cloudwatch.LogGroup(
            'handleDisconnectLogGroup',
            {
                name: pulumi.interpolate`/aws/lambda/${this.handleDisconnectFunction.name}`,
                retentionInDays: 14,
            },
            { parent: this }
        );

        this.disconnectIntegration = new aws.apigatewayv2.Integration(
            'disconnectIntegration',
            {
                apiId: this.websocketsApi.id,
                integrationType: 'AWS_PROXY',
                description: 'Disconnect Integration',
                integrationUri: pulumi.interpolate`arn:aws:apigateway:${aws.config.region}:lambda:path/2015-03-31/functions/${this.handleDisconnectFunction.arn}/invocations`,
            },
            { parent: this }
        );

        this.disconnectRoute = new aws.apigatewayv2.Route(
            'disconnectRoute',
            {
                apiId: this.websocketsApi.id,
                routeKey: '$disconnect',
                authorizationType: 'NONE',
                operationName: 'DisconnectRoute',
                target: pulumi.interpolate`integrations/${this.disconnectIntegration.id}`,
            },
            { parent: this }
        );

        const disconnectAttachment = attachLogsPolicy(
            'handleDisconnect',
            {
                function: this.handleDisconnectFunction,
                region: region,
                accountId: accountId,
            },
            { parent: this }
        );

        this.handleDisconnectLogsPolicy = disconnectAttachment.policy;
        this.handleDisconnectLogsPolicyAttachment =
            disconnectAttachment.attachment;

        this.messageRole = websocketsExecutionRole(
            'messageRole',
            {
                messagesBucket: this.messagesBucket.bucketName.apply((n) => n!),
                websocketsApi: this.websocketsApi,
            },
            { parent: this }
        );

        this.handleMessageFunction = new aws.lambda.Function(
            'handleMessage',
            {
                handler: 'websockets.message',
                code: inputs.websocketsCode,
                runtime: 'nodejs18.x',
                memorySize: 256,
                timeout: 100,
                description:
                    'Description: A function that handles websocket messages.',
                role: this.messageRole.arn,
                environment: functionEnvironmentVariables({
                    filesBucket: inputs.filesBucket.bucketName.apply((n) => n!),
                    filesStorageClass: inputs.filesStorageClass,
                    allowedOrigins: inputs.allowedOrigins,
                    allowedApiOrigins: inputs.allowedApiOrigins,
                    messagesBucket: this.messagesBucket.bucketName.apply(
                        (n) => n!
                    ),
                }),
            },
            { parent: this }
        );

        this.handleMessagePermission = new aws.lambda.Permission(
            'handleMessagePermission',
            {
                action: 'lambda:InvokeFunction',
                function: this.handleMessageFunction.name,
                principal: 'apigateway.amazonaws.com',
            },
            { parent: this }
        );

        this.handleMessageLogGroup = new aws.cloudwatch.LogGroup(
            'handleMessageLogGroup',
            {
                name: pulumi.interpolate`/aws/lambda/${this.handleMessageFunction.name}`,
                retentionInDays: 14,
            },
            { parent: this }
        );

        this.messageIntegration = new aws.apigatewayv2.Integration(
            'messageIntegration',
            {
                apiId: this.websocketsApi.id,
                integrationType: 'AWS_PROXY',
                description: 'Message Integration',
                integrationUri: pulumi.interpolate`arn:aws:apigateway:${aws.config.region}:lambda:path/2015-03-31/functions/${this.handleMessageFunction.arn}/invocations`,
            },
            { parent: this }
        );

        this.messageRoute = new aws.apigatewayv2.Route(
            'messageRoute',
            {
                apiId: this.websocketsApi.id,
                routeKey: '$default',
                authorizationType: 'NONE',
                operationName: 'MessageRoute',
                target: pulumi.interpolate`integrations/${this.messageIntegration.id}`,
            },
            { parent: this }
        );

        const messageAttachment = attachLogsPolicy(
            'handleMessage',
            {
                function: this.handleMessageFunction,
                region: region,
                accountId: accountId,
            },
            { parent: this }
        );

        this.handleMessageLogsPolicy = messageAttachment.policy;
        this.handleMessageLogsPolicyAttachment = messageAttachment.attachment;

        this.registerOutputs({
            webEndpoint: this.websocketsApi.apiEndpoint,
        });
    }
}
