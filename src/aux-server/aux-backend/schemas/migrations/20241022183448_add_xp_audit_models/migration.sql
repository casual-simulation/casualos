/*
  Warnings:

  - Added the required column `systemEventId` to the `XpAccountEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creationEventId` to the `XpContract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creationEventId` to the `XpInvoice` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "XpAccountEntry" DROP CONSTRAINT "XpAccountEntry_accountId_fkey1";

-- DropForeignKey
ALTER TABLE "XpContract" DROP CONSTRAINT "XpContract_accountId_fkey1";

-- DropForeignKey
ALTER TABLE "XpContract" DROP CONSTRAINT "XpContract_holdingUserId_fkey1";

-- DropForeignKey
ALTER TABLE "XpContract" DROP CONSTRAINT "XpContract_issuerId_fkey1";

-- DropForeignKey
ALTER TABLE "XpInvoice" DROP CONSTRAINT "XpInvoice_contractId_fkey1";

-- AlterTable
ALTER TABLE "XpAccountEntry" ADD COLUMN     "systemEventId" UUID NOT NULL;
ALTER TABLE "XpAccountEntry" ALTER COLUMN "accountId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "XpContract" ADD COLUMN     "creationEventId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "XpInvoice" ADD COLUMN     "creationEventId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "XpSystemEvent" (
    "id" UUID NOT NULL,
    "type" STRING NOT NULL,
    "xpUserId" UUID,
    "data" JSONB NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "adjustingEventId" UUID,
    "adjusterEventId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpSystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpSystemEventAdjustment" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpSystemEventAdjustment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "XpSystemEvent" ADD CONSTRAINT "XpEvent_xpUserId_fkey1" FOREIGN KEY ("xpUserId") REFERENCES "XpUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpSystemEvent" ADD CONSTRAINT "XpSystemEventAdjustment_adjustingEventId_fkey1" FOREIGN KEY ("adjustingEventId") REFERENCES "XpSystemEventAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpSystemEvent" ADD CONSTRAINT "XpSystemEventAdjustment_adjusterEventId_fkey1" FOREIGN KEY ("adjusterEventId") REFERENCES "XpSystemEventAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpSystemEventAdjustment" ADD CONSTRAINT "XpSystemEventAdjustment_id_fkey1" FOREIGN KEY ("id") REFERENCES "XpSystemEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAccountEntry" ADD CONSTRAINT "XpAccountEntry_accountId_fkey1" FOREIGN KEY ("accountId") REFERENCES "XpAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAccountEntry" ADD CONSTRAINT "XpAccountEntry_systemEventId_fkey1" FOREIGN KEY ("systemEventId") REFERENCES "XpSystemEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpContract" ADD CONSTRAINT "XpContract_issuerId_fkey1" FOREIGN KEY ("issuerUserId") REFERENCES "XpUser"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpContract" ADD CONSTRAINT "XpContract_holdingUserId_fkey1" FOREIGN KEY ("holdingUserId") REFERENCES "XpUser"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpContract" ADD CONSTRAINT "XpContract_accountId_fkey1" FOREIGN KEY ("accountId") REFERENCES "XpAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpContract" ADD CONSTRAINT "XpInvoice_creationEventId_fkey1" FOREIGN KEY ("creationEventId") REFERENCES "XpSystemEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpInvoice" ADD CONSTRAINT "XpInvoice_contractId_fkey1" FOREIGN KEY ("contractId") REFERENCES "XpContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpInvoice" ADD CONSTRAINT "XpInvoice_creationEventId_fkey1" FOREIGN KEY ("creationEventId") REFERENCES "XpSystemEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
