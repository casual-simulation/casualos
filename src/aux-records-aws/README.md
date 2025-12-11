# @casual-simulation/aux-records-aws

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-records-aws.svg)](https://www.npmjs.com/package/@casual-simulation/aux-records-aws)

AWS implementations for the CasualOS Records System. This package provides production-ready integrations with AWS services for file storage, authentication messaging, and content moderation.

## Overview

`aux-records-aws` implements the core interfaces from `@casual-simulation/aux-records` using AWS services:

-   **S3FileRecordsStore**: File storage and management using Amazon S3
-   **SimpleEmailServiceAuthMessenger**: Email-based authentication codes via Amazon SES
-   **TextItAuthMessenger**: SMS/email authentication via TextIt integration
-   **RekognitionModerationJobProvider**: Content moderation using Amazon Rekognition

## Installation

```bash
npm install @casual-simulation/aux-records-aws
```

## Components

### S3FileRecordsStore

Amazon S3 implementation of `FileRecordsStore` for managing file records in CasualOS.

**Features**:

-   Upload/download files to S3 with presigned URLs
-   File metadata tracking via `FileRecordsLookup`
-   Public and private file access control
-   Storage class configuration (STANDARD, GLACIER, etc.)
-   File listing and filtering
-   Bucket management (default and custom buckets)
-   Server-side signature generation for authenticated requests

**Configuration**:

```typescript
import { S3FileRecordsStore } from '@casual-simulation/aux-records-aws';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });

const store = new S3FileRecordsStore(
    'us-east-1', // AWS region
    'my-files-bucket', // Main bucket
    'my-default-bucket', // Default bucket
    fileRecordsLookup, // Database lookup for file metadata
    'STANDARD', // Storage class
    s3Client, // S3 client
    's3.amazonaws.com', // S3 host (optional)
    credentialProvider, // AWS credentials (optional)
    'https://cdn.example.com' // Public files CDN URL (optional)
);
```

**Example Usage**:

```typescript
// Presign file upload
const uploadResult = await store.presignFileUpload({
    recordName: 'myRecord',
    fileName: 'document.pdf',
    fileSha256Hex: 'abc123...',
    fileMimeType: 'application/pdf',
    fileByteLength: 1024000,
    headers: {},
});

if (uploadResult.success) {
    console.log('Upload URL:', uploadResult.uploadUrl);
    console.log('Upload method:', uploadResult.uploadMethod);
    console.log('Upload headers:', uploadResult.uploadHeaders);
}

// Presign file read
const readResult = await store.presignFileRead({
    recordName: 'myRecord',
    fileName: 'document.pdf',
});

if (readResult.success) {
    console.log('Download URL:', readResult.requestUrl);
}

// List files
const listResult = await store.listUploadedFiles('myRecord', 'document.pdf');

if (listResult.success) {
    console.log('Files:', listResult.files);
}
```

**Key Methods**:

-   `presignFileUpload(request)`: Generate presigned URL for file upload
-   `presignFileRead(request)`: Generate presigned URL for file download
-   `getFileRecord(recordName, fileName)`: Get file metadata
-   `setFileRecordAsUploaded(recordName, fileName)`: Mark file as uploaded
-   `eraseFileRecord(recordName, fileName)`: Delete file from S3
-   `listUploadedFiles(recordName, fileName)`: List files matching criteria
-   `getFileNameFromUrl(fileUrl)`: Extract record name and file name from URL

### SimpleEmailServiceAuthMessenger

Amazon SES implementation of `AuthMessenger` for sending authentication codes via email.

**Features**:

-   Send authentication codes via AWS SES
-   Template-based emails (using SES templates)
-   Plain text emails with variable substitution
-   Supports email address type only
-   Customizable sender address and content

**Configuration**:

```typescript
import { SimpleEmailServiceAuthMessenger } from '@casual-simulation/aux-records-aws';
import { SESv2Client } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({ region: 'us-east-1' });

// Using SES template
const messenger = new SimpleEmailServiceAuthMessenger(sesClient, {
    fromAddress: 'noreply@example.com',
    content: {
        type: 'template',
        templateArn: 'arn:aws:ses:us-east-1:123456789:template/AuthCode',
    },
});

// Using plain text with variable substitution
const messengerPlain = new SimpleEmailServiceAuthMessenger(sesClient, {
    fromAddress: 'noreply@example.com',
    content: {
        type: 'plain',
        subject: 'Your authentication code',
        body: 'Your code is: {{code}}',
    },
});
```

**Example Usage**:

```typescript
const result = await messenger.sendCode('user@example.com', 'email', '123456');

if (result.success) {
    console.log('Code sent successfully');
} else {
    console.error('Error:', result.errorCode, result.errorMessage);
}
```

**Template Variables**:

-   `{{code}}`: The authentication code
-   `{{address}}`: The recipient email address
-   `{{addressType}}`: The address type ('email')

### TextItAuthMessenger

TextIt integration for sending authentication codes via SMS or email.

**Features**:

-   Send authentication codes via TextIt flows
-   Supports both email and phone numbers
-   Flow-based message delivery
-   Configurable via TextIt API
-   Restart participants automatically for new codes

**Configuration**:

```typescript
import { TextItAuthMessenger } from '@casual-simulation/aux-records-aws';

const messenger = new TextItAuthMessenger(
    'your-textit-api-key',
    'your-flow-id'
);
```

**Example Usage**:

```typescript
// Send to phone
const smsResult = await messenger.sendCode('+1234567890', 'phone', '123456');

// Send to email
const emailResult = await messenger.sendCode(
    'user@example.com',
    'email',
    '123456'
);

if (smsResult.success) {
    console.log('SMS code sent');
}
```

**TextIt Flow Parameters**:
The flow receives the following parameters:

-   `code`: The authentication code to send

**Error Handling**:

-   `address_type_not_supported`: Address type not supported (only 'email' and 'phone')
-   `unacceptable_address`: Invalid address format
-   `server_error`: TextIt API error

### RekognitionModerationJobProvider

Amazon Rekognition implementation of `ModerationJobProvider` for content moderation.

**Features**:

-   Scan individual files using Rekognition
-   Create batch moderation jobs using S3 Batch Operations
-   Custom moderation models support
-   Configurable minimum confidence thresholds
-   Lambda-based batch processing
-   Manifest generation for batch jobs

**Configuration**:

```typescript
import { RekognitionModerationJobProvider } from '@casual-simulation/aux-records-aws';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { S3ControlClient } from '@aws-sdk/client-s3-control';
import { S3Client } from '@aws-sdk/client-s3';

const provider = new RekognitionModerationJobProvider({
    filesStore: s3FileRecordsStore,
    rekognition: new RekognitionClient({ region: 'us-east-1' }),
    s3Control: new S3ControlClient({ region: 'us-east-1' }),
    s3: new S3Client({ region: 'us-east-1' }),
    filesJob: {
        accountId: '123456789012',
        lambdaFunctionArn:
            'arn:aws:lambda:us-east-1:123456789:function:moderation',
        sourceBucket: 'my-files-bucket',
        reportBucket: 'my-reports-bucket',
        priority: 10,
        roleArn: 'arn:aws:iam::123456789:role/S3BatchRole',
        customModerationModelArn:
            'arn:aws:rekognition:us-east-1:123456789:project/...',
    },
});
```

**Example Usage**:

```typescript
// Scan single file
const scanResult = await provider.scanFile({
    recordName: 'myRecord',
    fileName: 'image.jpg',
    bucket: 'my-files-bucket',
});

if (scanResult.success && scanResult.result.detected) {
    console.log('Moderation labels:', scanResult.result.labels);
}

// Create batch moderation job
const jobResult = await provider.createModerationJob({
    type: 'files',
    filter: {
        createdAfter: Date.now() - 86400000, // Last 24 hours
        recordName: 'myRecord',
    },
});

if (jobResult.success) {
    console.log('Job created:', jobResult.job.jobId);
}
```

**Scan Result**:

```typescript
interface ModerationFileScan {
    detected: boolean;
    labels: Array<{
        name: string;
        confidence: number;
        parentName?: string;
    }>;
}
```

**Batch Job Options**:

-   `type: 'files'`: Create a batch moderation job for files
-   `filter`: Filter files by record name, creation date, etc.
-   Job generates a manifest in S3 and invokes Lambda for each file

## AWS Service Requirements

### Required AWS Services

1. **Amazon S3**: File storage

    - Permissions: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`

2. **Amazon SES** (optional): Email authentication codes

    - Permissions: `ses:SendEmail`, `ses:SendTemplatedEmail`

3. **Amazon Rekognition** (optional): Content moderation

    - Permissions: `rekognition:DetectModerationLabels`

4. **AWS S3 Control** (optional): Batch operations

    - Permissions: `s3:CreateJob`, `s3:DescribeJob`

5. **AWS Lambda** (optional): Batch moderation processing
    - Invoked by S3 Batch Operations

### IAM Policy Example

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::my-files-bucket/*",
                "arn:aws:s3:::my-files-bucket"
            ]
        },
        {
            "Effect": "Allow",
            "Action": ["ses:SendEmail", "ses:SendTemplatedEmail"],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": ["rekognition:DetectModerationLabels"],
            "Resource": "*"
        }
    ]
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CasualOS Records                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         @casual-simulation/aux-records             │   │
│  │  (Interfaces: FileRecordsStore, AuthMessenger)     │   │
│  └────────────────────┬───────────────────────────────┘   │
│                       │                                     │
│                       │ implements                          │
│                       │                                     │
│  ┌────────────────────▼───────────────────────────────┐   │
│  │      @casual-simulation/aux-records-aws            │   │
│  ├────────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐  │   │
│  │  │ S3FileRecords    │  │ SESAuthMessenger     │  │   │
│  │  │ Store            │  │                      │  │   │
│  │  │                  │  │ TextItAuthMessenger  │  │   │
│  │  └────────┬─────────┘  └──────────┬───────────┘  │   │
│  │           │                       │               │   │
│  │           │                       │               │   │
│  │  ┌────────▼────────────────────────▼───────────┐  │   │
│  │  │ RekognitionModerationJobProvider           │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  └────────────────────┬───────────────────────────────┘   │
│                       │                                     │
│                       │ uses                                │
│                       │                                     │
│  ┌────────────────────▼───────────────────────────────┐   │
│  │               AWS Services                         │   │
│  ├────────────────────────────────────────────────────┤   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │ Amazon   │  │ Amazon   │  │  Amazon      │   │   │
│  │  │ S3       │  │ SES      │  │  Rekognition │   │   │
│  │  └──────────┘  └──────────┘  └──────────────┘   │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌──────────┐                      │   │
│  │  │ S3 Batch │  │  AWS     │                      │   │
│  │  │ Ops      │  │  Lambda  │                      │   │
│  │  └──────────┘  └──────────┘                      │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

### AWS SDK v3

-   `@aws-sdk/client-s3`: S3 file operations
-   `@aws-sdk/client-sesv2`: SES email sending
-   `@aws-sdk/client-rekognition`: Content moderation
-   `@aws-sdk/client-s3-control`: S3 Batch Operations
-   `@aws-sdk/credential-providers`: AWS credentials

### CasualOS Packages

-   `@casual-simulation/aux-records`: Core interfaces
-   `@casual-simulation/aux-common`: Common types and utilities

### Other Dependencies

-   `axios`: HTTP client for TextIt API
-   `uuid`: Unique identifier generation

## Testing

The module includes comprehensive test files:

-   `S3FileRecordsStore.spec.ts`: S3 file storage tests
-   `SimpleEmailServiceAuthMessenger.spec.ts`: SES email tests
-   `TextItAuthMessenger.spec.ts`: TextIt integration tests

Run tests:

```bash
npm test
```

## License

AGPL-3.0-only

## Related Packages

-   `@casual-simulation/aux-records`: Core records system interfaces
-   `@casual-simulation/aux-common`: Common types and utilities
-   `@casual-simulation/aux-server`: CasualOS server implementation

## Contributing

See [DEVELOPERS.md](../../DEVELOPERS.md) for development guidelines.

## Version

Current version: 3.8.1

See [CHANGELOG.md](../../CHANGELOG.md) for version history.
