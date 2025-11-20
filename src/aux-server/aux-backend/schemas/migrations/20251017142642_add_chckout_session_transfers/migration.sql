-- AlterTable
ALTER TABLE "public"."AuthCheckoutSession" ADD COLUMN     "transactionId" STRING;
ALTER TABLE "public"."AuthCheckoutSession" ADD COLUMN     "transferIds" STRING[];
ALTER TABLE "public"."AuthCheckoutSession" ADD COLUMN     "transfersPending" BOOL;
