-- AlterTable
ALTER TABLE "public"."Record" ADD COLUMN     "creditAccountId" STRING(128);
ALTER TABLE "public"."Record" ADD COLUMN     "creditBillingEnabled" BOOL NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "public"."Record" ADD CONSTRAINT "Record_creditAccountId_fkey1" FOREIGN KEY ("creditAccountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
