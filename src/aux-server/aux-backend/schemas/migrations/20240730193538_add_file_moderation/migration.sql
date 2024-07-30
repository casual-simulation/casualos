-- CreateTable
CREATE TABLE "ModerationJob" (
    "id" UUID NOT NULL,
    "s3Id" STRING,
    "type" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileModerationResult" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "fileName" STRING(512) NOT NULL,
    "appearsToMatchBannedContent" BOOL NOT NULL,
    "modelVersion" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileModerationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileModerationLabel" (
    "id" UUID NOT NULL,
    "name" STRING(128) NOT NULL,
    "category" STRING(128),
    "confidence" FLOAT8 NOT NULL,
    "fileModerationId" UUID NOT NULL,

    CONSTRAINT "FileModerationLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationJob_s3Id_key" ON "ModerationJob"("s3Id");

-- CreateIndex
CREATE INDEX "ModerationJob_type_createdAt_idx" ON "ModerationJob"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FileModerationResult_appearsToMatchBannedContent_fileName_c_idx" ON "FileModerationResult"("appearsToMatchBannedContent", "fileName", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FileModerationLabel_fileModerationId_name_confidence_idx" ON "FileModerationLabel"("fileModerationId", "name", "confidence");

-- AddForeignKey
ALTER TABLE "FileModerationResult" ADD CONSTRAINT "FileModerationResult_jobId_fkey1" FOREIGN KEY ("jobId") REFERENCES "ModerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileModerationLabel" ADD CONSTRAINT "FileModerationLabel_fileModerationId_fkey1" FOREIGN KEY ("fileModerationId") REFERENCES "FileModerationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
