-- CreateTable
CREATE TABLE "WebhookRecord" (
    "recordName" STRING(128) NOT NULL,
    "address" STRING(512) NOT NULL,
    "markers" STRING[],
    "targetRecordName" STRING(128),
    "targetDataRecordAddress" STRING(512),
    "targetFileRecordFileName" STRING(512),
    "userId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- AddForeignKey
ALTER TABLE "WebhookRecord" ADD CONSTRAINT "WebhookRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRecord" ADD CONSTRAINT "WebhookRecord_targetRecordName_fkey1" FOREIGN KEY ("targetRecordName") REFERENCES "Record"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRecord" ADD CONSTRAINT "WebhookRecord_targetDataRecordAddress_fkey1" FOREIGN KEY ("targetRecordName", "targetDataRecordAddress") REFERENCES "DataRecord"("recordName", "address") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRecord" ADD CONSTRAINT "WebhookRecord_targetFileRecordFileName_fkey1" FOREIGN KEY ("targetRecordName", "targetFileRecordFileName") REFERENCES "FileRecord"("recordName", "fileName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRecord" ADD CONSTRAINT "WebhookRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
