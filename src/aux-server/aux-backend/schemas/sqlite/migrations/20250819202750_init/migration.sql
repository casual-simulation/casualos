-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "avatarPortraitUrl" TEXT,
    "avatarUrl" TEXT,
    "allSessionRevokeTime" DATETIME,
    "currentLoginRequestId" TEXT,
    "currentWebAuthnChallenge" TEXT,
    "banTime" DATETIME,
    "banReason" TEXT,
    "privoServiceId" TEXT,
    "privoParentServiceId" TEXT,
    "privoConsentUrl" TEXT,
    "subscriptionInfoId" TEXT,
    "subscriptionStatus" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionPeriodStart" DATETIME,
    "subscriptionPeriodEnd" DATETIME,
    "allowPublishData" BOOLEAN,
    "allowPublicData" BOOLEAN,
    "allowAI" BOOLEAN,
    "allowPublicInsts" BOOLEAN,
    "role" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_currentLoginRequestId_fkey" FOREIGN KEY ("currentLoginRequestId") REFERENCES "LoginRequest" ("requestId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_subscriptionInfoId_fkey" FOREIGN KEY ("subscriptionInfoId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAuthenticator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "credentialPublicKey" BLOB NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "aaguid" TEXT NOT NULL,
    "registeringUserAgent" TEXT,
    "transports" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAuthenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginRequest" (
    "requestId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secretHash" TEXT,
    "requestTime" DATETIME NOT NULL,
    "expireTime" DATETIME NOT NULL,
    "completedTime" DATETIME,
    "attemptCount" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "addressType" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoginRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "sessionId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "connectionSecret" TEXT,
    "oidProvider" TEXT,
    "oidAccessToken" TEXT,
    "oidTokenType" TEXT,
    "oidIdToken" TEXT,
    "oidRefreshToken" TEXT,
    "oidScope" TEXT,
    "oidExpiresAtMs" BIGINT,
    "grantedTime" DATETIME NOT NULL,
    "expireTime" DATETIME,
    "revokeTime" DATETIME,
    "revocable" BOOLEAN,
    "requestId" TEXT,
    "oidRequestId" TEXT,
    "webauthnRequestId" TEXT,
    "previousSessionId" TEXT,
    "nextSessionId" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuthSession_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LoginRequest" ("requestId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthSession_oidRequestId_fkey" FOREIGN KEY ("oidRequestId") REFERENCES "OpenIDLoginRequest" ("requestId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthSession_webauthnRequestId_fkey" FOREIGN KEY ("webauthnRequestId") REFERENCES "WebAuthnLoginRequest" ("requestId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthSession_previousSessionId_fkey" FOREIGN KEY ("previousSessionId") REFERENCES "AuthSession" ("sessionId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthSession_nextSessionId_fkey" FOREIGN KEY ("nextSessionId") REFERENCES "AuthSession" ("sessionId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpenIDLoginRequest" (
    "requestId" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT,
    "provider" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "codeMethod" TEXT NOT NULL,
    "authorizationUrl" TEXT NOT NULL,
    "redirectUrl" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestTime" DATETIME NOT NULL,
    "expireTime" DATETIME NOT NULL,
    "completedTime" DATETIME,
    "ipAddress" TEXT NOT NULL,
    "authorizationCode" TEXT,
    "authorizationTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebAuthnLoginRequest" (
    "requestId" TEXT NOT NULL PRIMARY KEY,
    "challenge" TEXT NOT NULL,
    "userId" TEXT,
    "requestTime" DATETIME NOT NULL,
    "expireTime" DATETIME NOT NULL,
    "completedTime" DATETIME,
    "ipAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebAuthnLoginRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailRule" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "pattern" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SmsRule" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "pattern" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "comId" TEXT,
    "logoUrl" TEXT,
    "ownerStudioComId" TEXT,
    "playerConfig" JSONB,
    "comIdConfig" JSONB,
    "loomConfig" JSONB,
    "humeConfig" JSONB,
    "subscriptionInfoId" TEXT,
    "subscriptionStatus" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionPeriodStart" DATETIME,
    "subscriptionPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Studio_ownerStudioComId_fkey" FOREIGN KEY ("ownerStudioComId") REFERENCES "Studio" ("comId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Studio_subscriptionInfoId_fkey" FOREIGN KEY ("subscriptionInfoId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioAssignment" (
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimaryContact" BOOLEAN NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("studioId", "userId"),
    CONSTRAINT "StudioAssignment_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudioAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Record" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "studioId" TEXT,
    "secretHashes" JSONB NOT NULL,
    "secretSalt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Record_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecordKey" (
    "recordName" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "secretHash"),
    CONSTRAINT "RecordKey_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecordKey_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Policy" (
    "recordName" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "marker"),
    CONSTRAINT "Policy_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "recordName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "name"),
    CONSTRAINT "Role_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "recordName" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expireTime" DATETIME,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "roleId", "subjectId"),
    CONSTRAINT "RoleAssignment_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourcePermissionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "resourceKind" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT,
    "options" JSONB,
    "subjectId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "userId" TEXT,
    "expireTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResourcePermissionAssignment_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourcePermissionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarkerPermissionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "resourceKind" TEXT,
    "action" TEXT,
    "options" JSONB,
    "subjectId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "userId" TEXT,
    "expireTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarkerPermissionAssignment_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarkerPermissionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrantedPackageEntitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "recordName" TEXT NOT NULL,
    "expireTime" DATETIME NOT NULL,
    "revokeTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GrantedPackageEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GrantedPackageEntitlement_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PackageRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GrantedPackageEntitlement_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "publisherId" TEXT NOT NULL,
    "subjectId" TEXT,
    "updatePolicy" JSONB NOT NULL,
    "deletePolicy" JSONB NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "DataRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DataRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DataRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualDataRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "publisherId" TEXT NOT NULL,
    "subjectId" TEXT,
    "updatePolicy" JSONB NOT NULL,
    "deletePolicy" JSONB NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "ManualDataRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManualDataRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManualDataRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileRecord" (
    "recordName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "subjectId" TEXT,
    "sizeInBytes" BIGINT NOT NULL,
    "description" TEXT,
    "bucket" TEXT,
    "uploadedAt" DATETIME,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "fileName"),
    CONSTRAINT "FileRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FileRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FileRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventRecord" (
    "recordName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" BIGINT NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "name"),
    CONSTRAINT "EventRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstRecord" (
    "recordName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "name"),
    CONSTRAINT "InstRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstBranch" (
    "recordName" TEXT NOT NULL,
    "instName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "temporary" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "instName", "name"),
    CONSTRAINT "InstBranch_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstBranch_recordName_instName_fkey" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord" ("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BranchUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "instName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "sizeInBytes" INTEGER NOT NULL,
    "updateData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    CONSTRAINT "BranchUpdate_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BranchUpdate_recordName_instName_fkey" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord" ("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BranchUpdate_recordName_instName_branchName_fkey" FOREIGN KEY ("recordName", "instName", "branchName") REFERENCES "InstBranch" ("recordName", "instName", "name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoadedPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "packageId" TEXT NOT NULL,
    "packageVersionId" TEXT NOT NULL,
    "instRecordName" TEXT NOT NULL,
    "instName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoadedPackage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LoadedPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PackageRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoadedPackage_packageVersionId_fkey" FOREIGN KEY ("packageVersionId") REFERENCES "PackageRecordVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoadedPackage_instRecordName_instName_fkey" FOREIGN KEY ("instRecordName", "instName") REFERENCES "InstRecord" ("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "targetRecordName" TEXT,
    "targetDataRecordAddress" TEXT,
    "targetFileRecordFileName" TEXT,
    "targetInstRecordName" TEXT,
    "targetPublicInstRecordName" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "WebhookRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookRecord_targetRecordName_fkey" FOREIGN KEY ("targetRecordName") REFERENCES "Record" ("name") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WebhookRecord_targetRecordName_targetDataRecordAddress_fkey" FOREIGN KEY ("targetRecordName", "targetDataRecordAddress") REFERENCES "DataRecord" ("recordName", "address") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WebhookRecord_targetRecordName_targetFileRecordFileName_fkey" FOREIGN KEY ("targetRecordName", "targetFileRecordFileName") REFERENCES "FileRecord" ("recordName", "fileName") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WebhookRecord_targetRecordName_targetInstRecordName_fkey" FOREIGN KEY ("targetRecordName", "targetInstRecordName") REFERENCES "InstRecord" ("recordName", "name") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WebhookRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "webhookAddress" TEXT NOT NULL,
    "statusCode" INTEGER,
    "stateSha256" TEXT NOT NULL,
    "requestTime" DATETIME NOT NULL,
    "responseTime" DATETIME NOT NULL,
    "errorResult" JSONB,
    "infoFileRecordName" TEXT,
    "infoFileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookRun_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookRun_recordName_webhookAddress_fkey" FOREIGN KEY ("recordName", "webhookAddress") REFERENCES "WebhookRecord" ("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookRun_infoFileRecordName_infoFileName_fkey" FOREIGN KEY ("infoFileRecordName", "infoFileName") REFERENCES "FileRecord" ("recordName", "fileName") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "NotificationRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PushSubscriptionUser" (
    "pushSubscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("pushSubscriptionId", "userId"),
    CONSTRAINT "PushSubscriptionUser_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PushSubscriptionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "notificationAddress" TEXT NOT NULL,
    "userId" TEXT,
    "pushSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationSubscription_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationSubscription_recordName_notificationAddress_fkey" FOREIGN KEY ("recordName", "notificationAddress") REFERENCES "NotificationRecord" ("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationSubscription_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SentNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "notificationAddress" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "icon" TEXT,
    "badge" TEXT,
    "silent" BOOLEAN,
    "tag" TEXT,
    "topic" TEXT,
    "defaultAction" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "sentTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SentNotification_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SentNotification_recordName_notificationAddress_fkey" FOREIGN KEY ("recordName", "notificationAddress") REFERENCES "NotificationRecord" ("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SentPushNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sentNotificationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "userId" TEXT,
    "pushSubscriptionId" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SentPushNotification_sentNotificationId_fkey" FOREIGN KEY ("sentNotificationId") REFERENCES "SentNotification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SentPushNotification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "NotificationSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SentPushNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SentPushNotification_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackageRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackageRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackageRecordVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "patch" INTEGER NOT NULL,
    "tag" TEXT,
    "sha256" TEXT NOT NULL,
    "auxSha256" TEXT NOT NULL,
    "auxFileName" TEXT NOT NULL,
    "entitlements" JSONB NOT NULL,
    "requiresReview" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "sizeInBytes" INTEGER NOT NULL,
    "createdFile" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackageRecordVersion_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackageRecordVersion_recordName_address_fkey" FOREIGN KEY ("recordName", "address") REFERENCES "PackageRecord" ("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackageRecordVersion_recordName_auxFileName_fkey" FOREIGN KEY ("recordName", "auxFileName") REFERENCES "FileRecord" ("recordName", "fileName") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackageRecordVersionReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageVersionId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "approvalType" TEXT,
    "reviewStatus" TEXT NOT NULL,
    "reviewComments" TEXT NOT NULL,
    "reviewingUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackageRecordVersionReview_packageVersionId_fkey" FOREIGN KEY ("packageVersionId") REFERENCES "PackageRecordVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackageRecordVersionReview_reviewingUserId_fkey" FOREIGN KEY ("reviewingUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "searchApiKey" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "SearchRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchRecordSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchRecordName" TEXT NOT NULL,
    "searchRecordAddress" TEXT NOT NULL,
    "targetRecordName" TEXT NOT NULL,
    "targetResourceKind" TEXT NOT NULL,
    "targetMarker" TEXT NOT NULL,
    "targetMapping" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SearchRecordSync_searchRecordName_searchRecordAddress_fkey" FOREIGN KEY ("searchRecordName", "searchRecordAddress") REFERENCES "SearchRecord" ("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchRecordSyncHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchRecordName" TEXT NOT NULL,
    "searchRecordAddress" TEXT NOT NULL,
    "syncId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "time" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "numSynced" INTEGER NOT NULL,
    "numErrored" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SearchRecordSyncHistory_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "SearchRecordSync" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Configuration" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeSubscriptionId" TEXT NOT NULL,
    "userId" TEXT,
    "studioId" TEXT,
    "subscriptionStatus" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionPeriod_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeInvoiceId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL,
    "currency" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER,
    "stripeHostedInvoiceUrl" TEXT NOT NULL,
    "stripeInvoicePdfUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SubscriptionPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiChatMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokens" INTEGER NOT NULL,
    "userId" TEXT,
    "studioId" TEXT,
    CONSTRAINT "AiChatMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiChatMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiImageMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "squarePixelsGenerated" INTEGER NOT NULL,
    "userId" TEXT,
    "studioId" TEXT,
    CONSTRAINT "AiImageMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiImageMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiSkyboxMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skyboxesGenerated" INTEGER NOT NULL,
    "userId" TEXT,
    "studioId" TEXT,
    CONSTRAINT "AiSkyboxMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiSkyboxMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiSloydMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelsCreated" INTEGER NOT NULL,
    "name" TEXT,
    "confidence" REAL,
    "mimeType" TEXT NOT NULL,
    "modelData" TEXT NOT NULL,
    "thumbnailBase64" TEXT,
    "baseModelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "studioId" TEXT,
    CONSTRAINT "AiSloydMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiSloydMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiOpenAIRealtimeMetrics" (
    "sessionId" TEXT NOT NULL PRIMARY KEY,
    "request" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "studioId" TEXT,
    CONSTRAINT "AiOpenAIRealtimeMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiOpenAIRealtimeMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrivoClientCredentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAtSeconds" INTEGER NOT NULL,
    "scope" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UserInstReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT,
    "inst" TEXT NOT NULL,
    "reportingUserId" TEXT,
    "reportingIpAddress" TEXT,
    "automaticReport" BOOLEAN NOT NULL,
    "reportReasonText" TEXT NOT NULL,
    "reportReason" TEXT NOT NULL,
    "reportedUrl" TEXT NOT NULL,
    "reportedPermalink" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserInstReport_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserInstReport_recordName_inst_fkey" FOREIGN KEY ("recordName", "inst") REFERENCES "InstRecord" ("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserInstReport_reportingUserId_fkey" FOREIGN KEY ("reportingUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "s3Id" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FileModerationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "recordName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "appearsToMatchBannedContent" BOOLEAN NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FileModerationResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ModerationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileModerationLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "confidence" REAL NOT NULL,
    "fileModerationId" TEXT NOT NULL,
    CONSTRAINT "FileModerationLabel_fileModerationId_fkey" FOREIGN KEY ("fileModerationId") REFERENCES "FileModerationResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioComIdRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "requestedComId" TEXT NOT NULL,
    "userId" TEXT,
    "requestingIpAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudioComIdRequest_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioComIdRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_currentLoginRequestId_key" ON "User"("currentLoginRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "User_privoServiceId_key" ON "User"("privoServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_subscriptionInfoId_key" ON "User"("subscriptionInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthenticator_credentialId_key" ON "UserAuthenticator"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_previousSessionId_key" ON "AuthSession"("previousSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_nextSessionId_key" ON "AuthSession"("nextSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenIDLoginRequest_state_key" ON "OpenIDLoginRequest"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_comId_key" ON "Studio"("comId");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_subscriptionInfoId_key" ON "Studio"("subscriptionInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeCustomerId_key" ON "Studio"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "RoleAssignment_recordName_subjectId_idx" ON "RoleAssignment"("recordName", "subjectId");

-- CreateIndex
CREATE INDEX "RoleAssignment_recordName_roleId_idx" ON "RoleAssignment"("recordName", "roleId");

-- CreateIndex
CREATE INDEX "ResourcePermissionAssignment_subjectType_subjectId_recordName_idx" ON "ResourcePermissionAssignment"("subjectType", "subjectId", "recordName");

-- CreateIndex
CREATE INDEX "ResourcePermissionAssignment_recordName_resourceKind_resourceId_action_subjectType_subjectId_idx" ON "ResourcePermissionAssignment"("recordName", "resourceKind", "resourceId", "action", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "MarkerPermissionAssignment_subjectType_subjectId_recordName_idx" ON "MarkerPermissionAssignment"("subjectType", "subjectId", "recordName");

-- CreateIndex
CREATE INDEX "MarkerPermissionAssignment_recordName_marker_action_subjectType_subjectId_idx" ON "MarkerPermissionAssignment"("recordName", "marker", "action", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "BranchUpdate_recordName_instName_branchName_id_idx" ON "BranchUpdate"("recordName", "instName", "branchName", "id");

-- CreateIndex
CREATE INDEX "PushSubscription_active_idx" ON "PushSubscription"("active");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_recordName_notificationAddress_userId_key" ON "NotificationSubscription"("recordName", "notificationAddress", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_recordName_notificationAddress_pushSubscriptionId_key" ON "NotificationSubscription"("recordName", "notificationAddress", "pushSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRecord_recordName_address_key" ON "PackageRecord"("recordName", "address");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRecordVersion_recordName_address_major_minor_patch_tag_key" ON "PackageRecordVersion"("recordName", "address", "major", "minor", "patch", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "SearchRecordSync_searchRecordName_searchRecordAddress_targetRecordName_targetResourceKind_targetMarker_key" ON "SearchRecordSync"("searchRecordName", "searchRecordAddress", "targetRecordName", "targetResourceKind", "targetMarker");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_studioId_key" ON "Subscription"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPeriod_invoiceId_key" ON "SubscriptionPeriod"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_periodId_key" ON "Invoice"("periodId");

-- CreateIndex
CREATE INDEX "PrivoClientCredentials_expiresAt_idx" ON "PrivoClientCredentials"("expiresAt");

-- CreateIndex
CREATE INDEX "UserInstReport_automaticReport_createdAt_recordName_inst_idx" ON "UserInstReport"("automaticReport", "createdAt" DESC, "recordName", "inst");

-- CreateIndex
CREATE INDEX "UserInstReport_reportReason_createdAt_recordName_inst_idx" ON "UserInstReport"("reportReason", "createdAt" DESC, "recordName", "inst");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationJob_s3Id_key" ON "ModerationJob"("s3Id");

-- CreateIndex
CREATE INDEX "ModerationJob_type_createdAt_idx" ON "ModerationJob"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FileModerationResult_appearsToMatchBannedContent_fileName_createdAt_idx" ON "FileModerationResult"("appearsToMatchBannedContent", "fileName", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FileModerationLabel_fileModerationId_name_confidence_idx" ON "FileModerationLabel"("fileModerationId", "name", "confidence");
