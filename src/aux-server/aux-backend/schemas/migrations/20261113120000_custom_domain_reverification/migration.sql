-- AlterTable
ALTER TABLE "public"."CustomDomain" ADD COLUMN     "consecutiveFailedChecks" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "public"."CustomDomain" ADD COLUMN     "lastCheckedAt" TIMESTAMP(3);
