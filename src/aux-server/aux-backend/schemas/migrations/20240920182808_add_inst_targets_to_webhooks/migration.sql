-- AlterTable
ALTER TABLE "WebhookRecord" ADD COLUMN     "targetInstRecordName" STRING(128);
ALTER TABLE "WebhookRecord" ADD COLUMN     "targetPublicInstRecordName" STRING(128);

-- AddForeignKey
ALTER TABLE "WebhookRecord" ADD CONSTRAINT "WebhookRecord_targetInstRecordName_fkey1" FOREIGN KEY ("targetRecordName", "targetInstRecordName") REFERENCES "InstRecord"("recordName", "name") ON DELETE SET NULL ON UPDATE CASCADE;
