-- DropForeignKey
ALTER TABLE "AiChatMetrics" DROP CONSTRAINT "AiChatMetrics_studioId_fkey";

-- DropForeignKey
ALTER TABLE "AiChatMetrics" DROP CONSTRAINT "AiChatMetrics_userId_fkey";

-- DropForeignKey
ALTER TABLE "AiImageMetrics" DROP CONSTRAINT "AiImageMetrics_studioId_fkey";

-- DropForeignKey
ALTER TABLE "AiImageMetrics" DROP CONSTRAINT "AiImageMetrics_userId_fkey";

-- DropForeignKey
ALTER TABLE "AiSkyboxMetrics" DROP CONSTRAINT "AiSkyboxMetrics_studioId_fkey";

-- DropForeignKey
ALTER TABLE "AiSkyboxMetrics" DROP CONSTRAINT "AiSkyboxMetrics_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuthSession" DROP CONSTRAINT "AuthSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "BranchUpdate" DROP CONSTRAINT "BranchUpdate_recordName_fkey";

-- DropForeignKey
ALTER TABLE "BranchUpdate" DROP CONSTRAINT "BranchUpdate_recordName_instName_branchName_fkey";

-- DropForeignKey
ALTER TABLE "BranchUpdate" DROP CONSTRAINT "BranchUpdate_recordName_instName_fkey";

-- DropForeignKey
ALTER TABLE "DataRecord" DROP CONSTRAINT "DataRecord_recordName_fkey";

-- DropForeignKey
ALTER TABLE "EventRecord" DROP CONSTRAINT "EventRecord_recordName_fkey";

-- DropForeignKey
ALTER TABLE "InstBranch" DROP CONSTRAINT "InstBranch_recordName_fkey";

-- DropForeignKey
ALTER TABLE "InstBranch" DROP CONSTRAINT "InstBranch_recordName_instName_fkey";

-- DropForeignKey
ALTER TABLE "InstRecord" DROP CONSTRAINT "InstRecord_recordName_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_periodId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "LoginRequest" DROP CONSTRAINT "LoginRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "ManualDataRecord" DROP CONSTRAINT "ManualDataRecord_recordName_fkey";

-- DropForeignKey
ALTER TABLE "Policy" DROP CONSTRAINT "Policy_recordName_fkey";

-- DropForeignKey
ALTER TABLE "RecordKey" DROP CONSTRAINT "RecordKey_recordName_fkey";

-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_recordName_fkey";

-- DropForeignKey
ALTER TABLE "RoleAssignment" DROP CONSTRAINT "RoleAssignment_recordName_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionPeriod" DROP CONSTRAINT "SubscriptionPeriod_subscriptionId_fkey";

-- AddForeignKey
ALTER TABLE "LoginRequest" ADD CONSTRAINT "LoginRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordKey" ADD CONSTRAINT "RecordKey_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualDataRecord" ADD CONSTRAINT "ManualDataRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecord" ADD CONSTRAINT "EventRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstRecord" ADD CONSTRAINT "InstRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstBranch" ADD CONSTRAINT "InstBranch_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstBranch" ADD CONSTRAINT "InstBranch_instName_fkey1" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord"("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_instName_fkey1" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord"("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_branchName_fkey1" FOREIGN KEY ("recordName", "instName", "branchName") REFERENCES "InstBranch"("recordName", "instName", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPeriod" ADD CONSTRAINT "SubscriptionPeriod_subscriptionId_fkey1" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey1" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_periodId_fkey1" FOREIGN KEY ("periodId") REFERENCES "SubscriptionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMetrics" ADD CONSTRAINT "AiChatMetrics_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMetrics" ADD CONSTRAINT "AiChatMetrics_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiImageMetrics" ADD CONSTRAINT "AiImageMetrics_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiImageMetrics" ADD CONSTRAINT "AiImageMetrics_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkyboxMetrics" ADD CONSTRAINT "AiSkyboxMetrics_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkyboxMetrics" ADD CONSTRAINT "AiSkyboxMetrics_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
