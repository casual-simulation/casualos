-- AlterTable
ALTER TABLE "CustomDomain" ADD COLUMN "consecutiveFailedChecks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CustomDomain" ADD COLUMN "lastCheckedAt" DECIMAL;
