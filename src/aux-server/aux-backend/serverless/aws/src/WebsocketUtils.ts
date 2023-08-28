import { v4 as uuid } from 'uuid';
import { AwsMessage } from './AwsMessages';
import axios from 'axios';
import { URL } from 'url';
import {
    S3,
    S3ClientConfig,
    PutObjectCommand,
    GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const MESSAGES_BUCKET_NAME = process.env.MESSAGES_BUCKET;

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getS3Client() {
    if (isOffline()) {
        return new S3({
            forcePathStyle: true,
            credentials: {
                accessKeyId: 'S3RVER',
                secretAccessKey: 'S3RVER',
            },
            endpoint: 'http://localhost:4569',
        });
    }
    return new S3();
}

export async function uploadMessage(client: S3, data: string): Promise<string> {
    const key = uuid();
    const response = await client.putObject({
        Bucket: MESSAGES_BUCKET_NAME,
        Key: key,
        ContentType: 'application/json',
        Body: data,
        ACL: 'public-read',
    });

    if (isOffline()) {
        return `http://localhost:4569/${MESSAGES_BUCKET_NAME}/${key}`;
    } else {
        return `https://${MESSAGES_BUCKET_NAME}.s3.amazonaws.com/${key}`;
    }
}

export async function getMessageUploadUrl(): Promise<string> {
    const client = getS3Client();
    const key = uuid();
    const params = new PutObjectCommand({
        Bucket: MESSAGES_BUCKET_NAME,
        Key: key,
        ContentType: 'application/json',
        ACL: 'bucket-owner-full-control',
    });
    const url = await getSignedUrl(client, params);
    return url;
}

export async function downloadObject(url: string): Promise<string> {
    const parsed = new URL(url);
    const client = getS3Client();
    const params: GetObjectCommandInput = {
        Bucket: MESSAGES_BUCKET_NAME,
        Key: parsed.pathname.slice(1),
    };
    const response = await client.getObject(params);
    return response.Body.transformToString('utf8');
}

/**
 * Determines if we are running offline with serverless-offline.
 */
export function isOffline(): boolean {
    return !!process.env.IS_OFFLINE;
}

/**
 * Parses the given data into a AWS Message.
 * @param data The data to parse.
 */
export function parseMessage<T>(data: unknown): T {
    try {
        if (typeof data === 'string') {
            const value = JSON.parse(data);
            return value;
        } else if (typeof data === 'object') {
            return <T>(<any>data);
        } else {
            console.warn('Unable to parse message!');
            return null;
        }
    } catch (err) {
        return null;
    }
}

let span: any;

export function setSpan(func: any) {
    span = func;
}

export function spanify<T extends Function>(label: string, func: T): T {
    // TODO: Fix
    // if(span) {
    //     return <T><any>(function(...args: any[]) {
    //         return span(label, async () => {
    //             return func(...args);
    //         });
    //     });
    // } else {
    return func;
    // }
}
