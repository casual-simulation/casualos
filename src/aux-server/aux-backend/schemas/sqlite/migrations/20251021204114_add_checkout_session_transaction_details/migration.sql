-- AlterTable
ALTER TABLE "AuthCheckoutSession" ADD COLUMN "transactionId" TEXT;
ALTER TABLE "AuthCheckoutSession" ADD COLUMN "transferIds" JSONB;
ALTER TABLE "AuthCheckoutSession" ADD COLUMN "transfersPending" BOOLEAN;
