/*
  Warnings:

  - A unique constraint covering the columns `[stripeAccountId]` on the table `Studio` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "stripeAccountId" STRING;
ALTER TABLE "Studio" ADD COLUMN     "stripeAccountRequirementsStatus" STRING;
ALTER TABLE "Studio" ADD COLUMN     "stripeAccountStatus" STRING;

-- CreateTable
CREATE TABLE "PurchasableItemRecord" (
    "recordName" STRING(128) NOT NULL,
    "address" STRING(512) NOT NULL,
    "name" STRING(128) NOT NULL,
    "description" STRING(1024) NOT NULL,
    "imageUrls" STRING[],
    "currency" STRING(15) NOT NULL,
    "cost" INT4 NOT NULL,
    "taxCode" STRING(64),
    "roleName" STRING(128) NOT NULL,
    "roleGrantTimeMs" INT4,
    "redirectUrl" STRING(2048) NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasableItemRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeAccountId_key" ON "Studio"("stripeAccountId");

-- AddForeignKey
ALTER TABLE "PurchasableItemRecord" ADD CONSTRAINT "PurchasableItemRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;
