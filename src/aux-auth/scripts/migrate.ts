const dynamodb = require('aws-sdk/clients/dynamodb');
const { PrismaClient } = require('@prisma/client');
const AWS = require('aws-sdk');
const prompts = require('prompts');
const path = require('path');
const fs = require('fs/promises');
const fsOld = require('fs');
const responsesFile = path.join(__dirname, 'responses.json');

async function start() {
    await new Promise((resolve) => {
        setTimeout(resolve, 100);
    });

    const reponse = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
            { title: 'Migrate', value: 'migrate' },
            { title: 'Collect Responses', value: 'collect' },
        ],
    });

    if (reponse.action === 'migrate') {
        await migrate();
    } else {
        await collectAndSaveResponses();
    }
}

async function collectAndSaveResponses() {
    const response = await collectResponses();
    await fs.writeFile(responsesFile, JSON.stringify(response, null, 4));
}

async function collectResponses() {
    return await prompts([
        {
            type: 'text',
            name: 'databaseUrl',
            message: 'Please enter the Database URL',
            required: true,
        },
        {
            type: 'text',
            name: 'awsRegion',
            message: 'Please enter the AWS Region',
            required: true,
        },
        {
            type: 'text',
            name: 'UsersTable',
            message: 'Please enter the name of the DynamoDB Users Table',
            required: true,
        },
        {
            type: 'text',
            name: 'UserAddressesTable',
            message: 'Please enter the name of the DynamoDB UserAddressesTable',
            required: true,
        },
        {
            type: 'text',
            name: 'EmailRulesTable',
            message: 'Please enter the name of the DynamoDB EmailRulesTable',
            required: true,
        },
        {
            type: 'text',
            name: 'SmsRulesTable',
            message: 'Please enter the name of the DynamoDB SmsRulesTable',
            required: true,
        },
        {
            type: 'text',
            name: 'PublicRecordsTable',
            message: 'Please enter the name of the DynamoDB PublicRecordsTable',
            required: true,
        },
        {
            type: 'text',
            name: 'PublicRecordsKeysTable',
            message:
                'Please enter the name of the DynamoDB PublicRecordsKeysTable',
            required: true,
        },
        {
            type: 'text',
            name: 'DataTable',
            message: 'Please enter the name of the DynamoDB DataTable',
            required: true,
        },
        {
            type: 'text',
            name: 'ManualDataTable',
            message: 'Please enter the name of the DynamoDB ManualDataTable',
            required: true,
        },
        {
            type: 'text',
            name: 'FilesTable',
            message: 'Please enter the name of the DynamoDB FilesTable',
            required: true,
        },
        {
            type: 'text',
            name: 'EventsTable',
            message: 'Please enter the name of the DynamoDB EventsTable',
            required: true,
        },
    ]);
}

async function migrate() {
    let response: any;
    if (fsOld.existsSync(responsesFile)) {
        response = JSON.parse(await fs.readFile(responsesFile, 'utf8'));
    } else {
        response = await collectResponses();
    }

    AWS.config.update({
        region: response.awsRegion,
    });

    const client = new PrismaClient({
        datasources: {
            db: {
                url: response.databaseUrl,
            },
        },
    });
    const dynamo = new dynamodb.DocumentClient();

    console.log('Migrating users...');
    const users = await downloadAllItems(response.UsersTable, dynamo);

    const validUsers = users.filter((u) => !!u.email || !!u.phoneNumber);
    const userIds = new Set<string>(validUsers.map((u) => u.id));

    console.log('Creating user records...');
    const userCount = await client.user.createMany({
        data: validUsers.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            avatarUrl: user.avatarUrl,
            avatarPortraitUrl: user.avatarPortraitUrl,
            banTime: convertMsToDate(user.banTimeMs),
            banReason: user.banReason,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionId: user.subscriptionId,
            stripeCustomerId: user.stripeCustomerId,
        })),
        skipDuplicates: true,
    });

    console.log(`Created ${userCount.count} users.`);

    console.log('Migrating email rules...');
    const emailRules = await downloadAllItems(response.EmailRulesTable, dynamo);

    console.log('Creating email rule records...');
    const emailRuleCount = await client.emailRule.createMany({
        data: emailRules.map((rule) => ({
            id: rule.id,
            type: rule.type,
            pattern: rule.pattern,
        })),
        skipDuplicates: true,
    });

    console.log(`Created ${emailRuleCount.count} email rules.`);

    console.log('Migrating sms rules...');
    const smsRules = await downloadAllItems(response.SmsRulesTable, dynamo);

    console.log('Creating sms rule records...');
    const smsRuleCount = await client.smsRule.createMany({
        data: smsRules.map((rule) => ({
            id: rule.id,
            type: rule.type,
            pattern: rule.pattern,
        })),
        skipDuplicates: true,
    });

    console.log(`Created ${smsRuleCount.count} sms rules.`);

    console.log('Migrating public records...');
    const publicRecords = await downloadAllItems(
        response.PublicRecordsTable,
        dynamo
    );
    const validRecords = publicRecords.filter((r) => userIds.has(r.ownerId));
    const recordNames = new Set<string>(validRecords.map((r) => r.name));

    console.log('Creating public record records...');
    const publicRecordCount = await client.record.createMany({
        data: validRecords.map((record) => ({
            name: record.recordName,
            ownerId: record.ownerId,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
        })),
        skipDuplicates: true,
    });

    console.log(`Created ${publicRecordCount.count} public records.`);

    console.log('Migrating public record keys...');
    const publicRecordKeys = await downloadAllItems(
        response.PublicRecordsKeysTable,
        dynamo
    );

    console.log('Creating public record key records...');
    const publicRecordKeyCount = await client.recordKey.createMany({
        data: publicRecordKeys
            .filter((rk) => userIds.has(rk.creatorId))
            .map((key) => ({
                recordName: key.recordName,
                secretHash: key.secretHash,
                creatorId: key.creatorId,
                policy: key.policy,
                createdAt: convertMsToDate(key.creationTime),
            })),
        skipDuplicates: true,
    });

    console.log(`Created ${publicRecordKeyCount.count} public record keys.`);

    console.log('Migrating data...');
    const data = await downloadAllItems(response.DataTable, dynamo);

    console.log('Creating data records...');
    const dataCount = await client.dataRecord.createMany({
        data: data
            .filter(
                (d) =>
                    recordNames.has(d.recordName) &&
                    userIds.has(d.publisherId) &&
                    (!d.subjectId || userIds.has(d.subjectId))
            )
            .map((d) => ({
                recordName: d.recordName,
                address: d.address,
                data: d.data,
                publisherId: d.publisherId,
                subjectId: d.subjectId,
                updatePolicy: d.updatePolicy,
                deletePolicy: d.deletePolicy,
                markers: d.markers,
            })),
        skipDuplicates: true,
    });

    console.log(`Created ${dataCount.count} data records.`);

    console.log('Migrating manual data...');
    const manualData = await downloadAllItems(response.ManualDataTable, dynamo);

    console.log('Creating manual data records...');
    const manualDataCount = await client.dataRecord.createMany({
        data: manualData
            .filter(
                (d) =>
                    recordNames.has(d.recordName) &&
                    userIds.has(d.publisherId) &&
                    (!d.subjectId || userIds.has(d.subjectId))
            )
            .map((d) => ({
                recordName: d.recordName,
                address: d.address,
                data: d.data,
                publisherId: d.publisherId,
                subjectId: d.subjectId,
                updatePolicy: d.updatePolicy,
                deletePolicy: d.deletePolicy,
                markers: d.markers,
            })),
        skipDuplicates: true,
    });

    console.log(`Created ${manualDataCount.count} manual data records.`);

    console.log('Migrating files...');
    const files = await downloadAllItems(response.FilesTable, dynamo);

    console.log('Creating file records...');
    const fileCount = await client.fileRecord.createMany({
        data: files
            .filter(
                (f) =>
                    recordNames.has(f.recordName) &&
                    userIds.has(f.publisherId) &&
                    (!f.subjectId || userIds.has(f.subjectId))
            )
            .map((f) => ({
                recordName: f.recordName,
                fileName: f.fileName,
                publisherId: f.publisherId,
                subjectId: f.subjectId,
                sizeInBytes: f.sizeInBytes,
                description: f.description,
                createdAt: convertMsToDate(f.publishTime),
                uploadedAt: convertMsToDate(f.uploadTime),
                markers: f.markers,
            })),
        skipDuplicates: true,
    });

    console.log(`Created ${fileCount.count} files.`);

    console.log('Migrating events...');
    const events = await downloadAllItems(response.EventsTable, dynamo);

    console.log('Creating event records...');
    const eventCount = await client.eventRecord.createMany({
        data: events
            .filter((e) => recordNames.has(e.recordName))
            .map((e) => ({
                recordName: e.recordName,
                name: e.eventName,
                count: e.count,
                markers: e.markers,
                updatedAt: convertMsToDate(e.updateTime),
            })),
        skipDuplicates: true,
    });

    console.log(`Created ${eventCount.count} events.`);

    console.log('Done!');
}

start();

async function downloadAllItems(tableName: string, client: any) {
    console.log('Downloading all items from table: ' + tableName);
    let items: any[] = [];

    let lastKey: any = null;

    do {
        const response = await client
            .scan({
                TableName: tableName,
                ExclusiveStartKey: lastKey,
            })
            .promise();

        items = items.concat(response.Items);
        lastKey = response.LastEvaluatedKey;
    } while (!!lastKey);

    console.log(`Got ${items.length} items.`);
    return items;
}

function convertMsToDate(ms: number) {
    if (!ms || ms === Infinity) {
        return null;
    }
    return new Date(ms);
}
