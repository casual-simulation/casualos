/*
  Warnings:

  - A unique constraint covering the columns `[checkoutSessionId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `Studio` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "checkoutSessionId" UUID;
ALTER TABLE "Invoice" ALTER COLUMN "subscriptionId" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "periodId" DROP NOT NULL;

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
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasableItemRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateTable
CREATE TABLE "AuthCheckoutSession" (
    "id" UUID NOT NULL,
    "paid" BOOL NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "items" JSONB NOT NULL,
    "stripeStatus" STRING NOT NULL,
    "stripePaymentStatus" STRING NOT NULL,
    "stripeCheckoutSessionId" STRING NOT NULL,
    "invoiceId" UUID,
    "userId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasedItem" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "userId" STRING,
    "purchasableItemAddress" STRING(512) NOT NULL,
    "checkoutSessionId" UUID,
    "roleName" STRING(128) NOT NULL,
    "roleGrantTimeMs" INT4,
    "activatedTime" TIMESTAMP(3),
    "activationKeyId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationKey" (
    "id" STRING NOT NULL,
    "secretHash" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthCheckoutSession_stripeCheckoutSessionId_key" ON "AuthCheckoutSession"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthCheckoutSession_invoiceId_key" ON "AuthCheckoutSession"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_checkoutSessionId_key" ON "Invoice"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeAccountId_key" ON "Studio"("stripeAccountId");

-- AddForeignKey
ALTER TABLE "PurchasableItemRecord" ADD CONSTRAINT "PurchasableItemRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthCheckoutSession" ADD CONSTRAINT "PurchasableItemCheckoutSession_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasedItem" ADD CONSTRAINT "PurchasedItem_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasedItem" ADD CONSTRAINT "PurchasedItem_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasedItem" ADD CONSTRAINT "PurchasedItem_purchasableItemAddress_fkey1" FOREIGN KEY ("recordName", "purchasableItemAddress") REFERENCES "PurchasableItemRecord"("recordName", "address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasedItem" ADD CONSTRAINT "PurchasedItem_checkoutSessionId_fkey1" FOREIGN KEY ("checkoutSessionId") REFERENCES "AuthCheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasedItem" ADD CONSTRAINT "PurchasedItem_activationKeyId_fkey1" FOREIGN KEY ("activationKeyId") REFERENCES "ActivationKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_checkoutSessionId_fkey1" FOREIGN KEY ("checkoutSessionId") REFERENCES "AuthCheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
