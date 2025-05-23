/*
  Warnings:

  - You are about to drop the column `creationEventId` on the `XpInvoice` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "XpInvoice" DROP CONSTRAINT "XpInvoice_creationEventId_fkey1";

-- AlterTable
ALTER TABLE "XpInvoice" DROP COLUMN "creationEventId";
