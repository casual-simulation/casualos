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
import { S3 } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import path from 'path';
import YAML from 'yaml';
import root from '../../../script/root-path.cjs';

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
            root,
            'src',
            'aux-server',
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
