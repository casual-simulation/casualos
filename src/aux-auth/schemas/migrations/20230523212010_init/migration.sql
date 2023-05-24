-- CreateTable
CREATE TABLE "User" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "email" STRING NOT NULL,
    "avatarPortraitUrl" STRING,
    "avatarUrl" STRING,
    "allSessionRevokeTimeMs" INT8,
    "currentLoginRequestId" STRING,
    "stripeCustomerId" STRING,
    "openAiKey" STRING,
    "banTimeMs" INT8,
    "banReason" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginRequest" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "secretHash" STRING NOT NULL,
    "requestTimeMs" INT8 NOT NULL,
    "expireTimeMs" INT8 NOT NULL,
    "completedTimeMs" INT8,
    "attemptCount" INT4 NOT NULL,
    "address" STRING NOT NULL,
    "addressType" STRING NOT NULL,
    "ipAddress" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "secretHash" STRING NOT NULL,
    "grantedTimeMs" INT8 NOT NULL,
    "expireTimeMs" INT8 NOT NULL,
    "revokeTimeMs" INT8,
    "requestId" STRING,
    "previousSessionId" STRING,
    "ipAddress" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRule" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "type" STRING NOT NULL,
    "pattern" STRING NOT NULL,

    CONSTRAINT "EmailRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsRule" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "type" STRING NOT NULL,
    "pattern" STRING NOT NULL,

    CONSTRAINT "SmsRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "name" STRING NOT NULL,
    "ownerId" STRING NOT NULL,
    "secretHashes" STRING[],
    "secretSalt" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "RecordKey" (
    "recordName" STRING NOT NULL,
    "secretHash" STRING NOT NULL,
    "policy" STRING NOT NULL,
    "creatorId" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordKey_pkey" PRIMARY KEY ("recordName","secretHash")
);

-- CreateTable
CREATE TABLE "Policy" (
    "recordName" STRING NOT NULL,
    "marker" STRING NOT NULL,
    "document" JSONB NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("recordName","marker")
);

-- CreateTable
CREATE TABLE "Role" (
    "recordName" STRING NOT NULL,
    "name" STRING NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("recordName","name")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "recordName" STRING NOT NULL,
    "roleId" STRING NOT NULL,
    "subjectId" STRING NOT NULL,
    "type" STRING NOT NULL,
    "expireTimeMs" INT8,
    "userId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("recordName","roleId","subjectId")
);

-- CreateTable
CREATE TABLE "DataRecord" (
    "recordName" STRING NOT NULL,
    "address" STRING NOT NULL,
    "data" JSONB NOT NULL,
    "publisherId" STRING NOT NULL,
    "subjectId" STRING NOT NULL,
    "updatePolicy" STRING NOT NULL,
    "deletePolicy" STRING NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateTable
CREATE TABLE "FileRecord" (
    "recordName" STRING NOT NULL,
    "fileName" STRING NOT NULL,
    "publisherId" STRING NOT NULL,
    "subjectId" STRING NOT NULL,
    "sizeInBytes" INT8 NOT NULL,
    "description" STRING NOT NULL,
    "uploaded" BOOL NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("recordName","fileName")
);

-- CreateTable
CREATE TABLE "EventRecord" (
    "recordName" STRING NOT NULL,
    "name" STRING NOT NULL,
    "count" INT8 NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRecord_pkey" PRIMARY KEY ("recordName","name")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_previousSessionId_key" ON "AuthSession"("previousSessionId");

-- AddForeignKey
ALTER TABLE "LoginRequest" ADD CONSTRAINT "LoginRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LoginRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_previousSessionId_fkey" FOREIGN KEY ("previousSessionId") REFERENCES "AuthSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordKey" ADD CONSTRAINT "RecordKey_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordKey" ADD CONSTRAINT "RecordKey_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_recordName_roleId_fkey" FOREIGN KEY ("recordName", "roleId") REFERENCES "Role"("recordName", "name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecord" ADD CONSTRAINT "EventRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
