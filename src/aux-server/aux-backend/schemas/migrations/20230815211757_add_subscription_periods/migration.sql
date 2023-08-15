-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "subscriptionPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Studio" ADD COLUMN     "subscriptionPeriodStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionPeriodEnd" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "subscriptionPeriodStart" TIMESTAMP(3);
