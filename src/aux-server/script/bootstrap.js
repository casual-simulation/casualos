const { S3 } = require('@aws-sdk/client-s3');
const { readFileSync } = require('fs');
const path = require('path');
const YAML = require('yaml');
const { v4: uuid } = require('uuid');

const region = 'us-east-1';
const s3 = new S3({
    region: region,
    accessKeyId: 'xxxx',
    secretAccessKey: 'xxxx',

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
        const buckets = await s3.listBuckets({});
        const hasFilesBucket = buckets.Buckets.some(
            (b) => b.Name === FILES_BUCKET
        );
        if (!hasFilesBucket || reset) {
            if (hasFilesBucket) {
                await deleteBucket(FILES_BUCKET);
            }

            console.log('Creating Files Bucket');
            await s3.createBucket({
                Bucket: FILES_BUCKET,
            });

            await s3.putBucketCors({
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
            });
        } else {
            console.log('Files Bucket already exists');
        }
    } catch (err) {
        console.log('Unable to Create S3 buckets.', err.toString());
    }
}

async function deleteBucket(bucketName) {
    console.log(`Deleting "${bucketName}" Bucket`);
    const objects = await s3.listObjects({
        Bucket: bucketName,
    });
    await Promise.all(
        objects.Contents.map(async (object) => {
            await s3.deleteObject({
                Bucket: bucketName,
                Key: object.Key,
            });
        })
    );
    await s3.deleteBucket({
        Bucket: bucketName,
    });
}
