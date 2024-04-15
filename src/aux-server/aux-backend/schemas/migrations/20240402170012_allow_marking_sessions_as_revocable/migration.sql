-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "revocable" BOOL;
ALTER TABLE "AuthSession" ALTER COLUMN "expireTime" DROP NOT NULL;
