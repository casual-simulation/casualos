-- CreateTable
CREATE TABLE "WebhookRun" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "webhookAddress" STRING(512) NOT NULL,
    "statusCode" INT4,
    "stateSha256" STRING(64) NOT NULL,
    "requestTime" TIMESTAMP(3) NOT NULL,
    "responseTime" TIMESTAMP(3) NOT NULL,
    "errorResult" JSONB,
    "infoFileRecordName" STRING(128),
    "infoFileName" STRING(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookRun_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WebhookRun" ADD CONSTRAINT "WebhookRun_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRun" ADD CONSTRAINT "WebhookRun_webhookAddress_fkey1" FOREIGN KEY ("recordName", "webhookAddress") REFERENCES "WebhookRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRun" ADD CONSTRAINT "WebhookRun_infoFile_fkey1" FOREIGN KEY ("infoFileRecordName", "infoFileName") REFERENCES "FileRecord"("recordName", "fileName") ON DELETE SET NULL ON UPDATE CASCADE;
