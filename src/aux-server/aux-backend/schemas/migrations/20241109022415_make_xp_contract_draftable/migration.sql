/*
  Warnings:

  - You are about to drop the column `creationEventId` on the `XpContract` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "XpContract" DROP CONSTRAINT "XpInvoice_creationEventId_fkey1";

-- AlterTable
ALTER TABLE "XpContract" DROP COLUMN "creationEventId";
ALTER TABLE "XpContract" ADD COLUMN     "offeredWorth" INT4;
ALTER TABLE "XpContract" ALTER COLUMN "holdingUserId" DROP NOT NULL;
ALTER TABLE "XpContract" ALTER COLUMN "accountId" DROP NOT NULL;
