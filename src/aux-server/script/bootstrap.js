const AWS = require('aws-sdk');
const { readFileSync } = require('fs');
const path = require('path');
const YAML = require('yaml');
const { v4: uuid } = require('uuid');

AWS.config.update({
    region: 'us-east-1',

    // Dummy credentials
    accessKeyId: 'xxxx',
    secretAccessKey: 'xxxx',
});

const s3 = new AWS.S3({
    endpoint: 'http://localhost:4566',
    apiVersion: '2006-03-01',
    s3ForcePathStyle: true,
});

// See env.json
const FILES_BUCKET = 'files-bucket';

async function start() {
    const reset = process.argv.includes('--reset');

    const templateSrc = readFileSync(
        path.resolve(
            __dirname,
            '..',
            'aux-backend',
            'serverless',
            'aws',
            'template.yml'
        ),
        { encoding: 'utf8' }
    );
    const template = YAML.parseDocument(templateSrc).toJSON();

    await createS3Buckets(reset);
}

start().then(
    () => {
        console.log('Done.');
    },
    (err) => {
        console.log('Finished bootstrap with error: ', err);
    }
);

async function createS3Buckets(reset) {
    try {
        const buckets = await s3.listBuckets().promise();
        const hasFilesBucket = buckets.Buckets.some(
            (b) => b.Name === FILES_BUCKET
        );
        if (!hasFilesBucket || reset) {
            if (hasFilesBucket) {
                await deleteBucket(FILES_BUCKET);
            }

            console.log('Creating Files Bucket');
            await s3
                .createBucket({
                    Bucket: FILES_BUCKET,
                })
                .promise();

            await s3
                .putBucketCors({
                    Bucket: FILES_BUCKET,
                    CORSConfiguration: {
                        CORSRules: [
                            {
                                AllowedHeaders: ['*'],
                                AllowedMethods: ['GET', 'PUT', 'POST'],
                                AllowedOrigins: ['*'],
                                ExposeHeaders: [],
                                MaxAgeSeconds: 3000,
                            },
                        ],
                    },
                })
                .promise();
        } else {
            console.log('Files Bucket already exists');
        }
    } catch (err) {
        console.log('Unable to Create S3 buckets.', err.toString());
    }
}

async function deleteBucket(bucketName) {
    console.log(`Deleting "${bucketName}" Bucket`);
    const objects = await s3
        .listObjects({
            Bucket: bucketName,
        })
        .promise();
    await Promise.all(
        objects.Contents.map(async (object) => {
            await s3
                .deleteObject({
                    Bucket: bucketName,
                    Key: object.Key,
                })
                .promise();
        })
    );
    await s3
        .deleteBucket({
            Bucket: bucketName,
        })
        .promise();
}
