import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as apigateway from '@pulumi/aws-apigateway';
import * as awsNative from '@pulumi/aws-native';
import { HandleRecordsComponent } from './records';
import {
    rekognitionLabelsPolicy,
    s3CrudPolicy,
    sesCrudPolicy,
} from './policies';

let config = new pulumi.Config();
const sesIdentityName = config.get('sesIdentityName');

const component = new HandleRecordsComponent(
    'handleRecords',
    {
        sesIdentityName,
    },
    {}
);

// The URL at which the REST API will be served.
// export const url = component..url;
