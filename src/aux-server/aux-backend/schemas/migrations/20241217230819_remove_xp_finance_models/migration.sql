/*
  Warnings:

  - You are about to drop the `XpAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `XpAccountEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `XpSystemEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `XpSystemEventAdjustment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "XpAccountEntry" DROP CONSTRAINT "XpAccountEntry_accountId_fkey1";

-- DropForeignKey
ALTER TABLE "XpAccountEntry" DROP CONSTRAINT "XpAccountEntry_systemEventId_fkey1";

-- DropForeignKey
ALTER TABLE "XpContract" DROP CONSTRAINT "XpContract_accountId_fkey1";

-- DropForeignKey
ALTER TABLE "XpSystemEvent" DROP CONSTRAINT "XpEvent_xpUserId_fkey1";

-- DropForeignKey
ALTER TABLE "XpSystemEvent" DROP CONSTRAINT "XpSystemEventAdjustment_adjusterEventId_fkey1";

-- DropForeignKey
ALTER TABLE "XpSystemEvent" DROP CONSTRAINT "XpSystemEventAdjustment_adjustingEventId_fkey1";

-- DropForeignKey
ALTER TABLE "XpSystemEventAdjustment" DROP CONSTRAINT "XpSystemEventAdjustment_id_fkey1";

-- DropForeignKey
ALTER TABLE "XpUser" DROP CONSTRAINT "XpUser_accountId_fkey1";

-- DropTable
DROP TABLE "XpAccount";

-- DropTable
DROP TABLE "XpAccountEntry";

-- DropTable
DROP TABLE "XpSystemEvent";

-- DropTable
DROP TABLE "XpSystemEventAdjustment";
