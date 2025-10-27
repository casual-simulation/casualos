/*
  Warnings:

  - A unique constraint covering the columns `[checkoutSessionId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `Studio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "checkoutSessionId" UUID;
ALTER TABLE "public"."Invoice" ALTER COLUMN "subscriptionId" DROP NOT NULL;
ALTER TABLE "public"."Invoice" ALTER COLUMN "periodId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Studio" ADD COLUMN     "stripeAccountId" STRING;
ALTER TABLE "public"."Studio" ADD COLUMN     "stripeAccountRequirementsStatus" STRING;
ALTER TABLE "public"."Studio" ADD COLUMN     "stripeAccountStatus" STRING;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "requestedRate" INT4;
ALTER TABLE "public"."User" ADD COLUMN     "stripeAccountId" STRING;
ALTER TABLE "public"."User" ADD COLUMN     "stripeAccountRequirementsStatus" STRING;
ALTER TABLE "public"."User" ADD COLUMN     "stripeAccountStatus" STRING;

-- CreateTable
CREATE TABLE "public"."PurchasableItemRecord" (
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
CREATE TABLE "public"."AuthCheckoutSession" (
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
CREATE TABLE "public"."PurchasedItem" (
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
CREATE TABLE "public"."ActivationKey" (
    "id" STRING NOT NULL,
    "secretHash" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancialAccount" (
    "id" STRING(128) NOT NULL,
    "userId" STRING,
    "studioId" STRING,
    "contractId" UUID,
    "ledger" INT4 NOT NULL,
    "currency" STRING(15) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContractRecord" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "address" STRING(512) NOT NULL,
    "issuerUserId" STRING NOT NULL,
    "holdingUserId" STRING NOT NULL,
    "rate" INT4 NOT NULL,
    "initialValue" INT4 NOT NULL,
    "description" STRING,
    "status" STRING NOT NULL,
    "stripeCheckoutSessionId" STRING(128),
    "stripePaymentIntentId" STRING(128),
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContractInvoice" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "amount" INT4 NOT NULL,
    "status" STRING NOT NULL,
    "payoutDestination" STRING NOT NULL,
    "voidReason" STRING,
    "transactionId" STRING(128),
    "note" STRING,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "externalPayoutId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExternalPayout" (
    "id" UUID NOT NULL,
    "invoiceId" UUID,
    "userId" STRING NOT NULL,
    "transferId" STRING(128) NOT NULL,
    "transactionId" STRING(128) NOT NULL,
    "externalDestination" STRING(32) NOT NULL,
    "stripeTransferId" STRING,
    "destinationStripeAccountId" STRING,
    "amount" INT4 NOT NULL,
    "postedTransferId" STRING(128),
    "voidedTransferId" STRING(128),
    "initiatedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthCheckoutSession_stripeCheckoutSessionId_key" ON "public"."AuthCheckoutSession"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthCheckoutSession_invoiceId_key" ON "public"."AuthCheckoutSession"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_contractId_key" ON "public"."FinancialAccount"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_userId_studioId_contractId_ledger_key" ON "public"."FinancialAccount"("userId", "studioId", "contractId", "ledger");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRecord_stripeCheckoutSessionId_key" ON "public"."ContractRecord"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRecord_stripePaymentIntentId_key" ON "public"."ContractRecord"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRecord_recordName_address_key" ON "public"."ContractRecord"("recordName", "address");

-- CreateIndex
CREATE UNIQUE INDEX "ContractInvoice_externalPayoutId_key" ON "public"."ContractInvoice"("externalPayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayout_invoiceId_key" ON "public"."ExternalPayout"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayout_transferId_key" ON "public"."ExternalPayout"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_checkoutSessionId_key" ON "public"."Invoice"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeAccountId_key" ON "public"."Studio"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "public"."User"("stripeAccountId");

-- AddForeignKey
ALTER TABLE "public"."PurchasableItemRecord" ADD CONSTRAINT "PurchasableItemRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "public"."Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthCheckoutSession" ADD CONSTRAINT "PurchasableItemCheckoutSession_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedItem" ADD CONSTRAINT "PurchasedItem_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "public"."Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedItem" ADD CONSTRAINT "PurchasedItem_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedItem" ADD CONSTRAINT "PurchasedItem_purchasableItemAddress_fkey1" FOREIGN KEY ("recordName", "purchasableItemAddress") REFERENCES "public"."PurchasableItemRecord"("recordName", "address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedItem" ADD CONSTRAINT "PurchasedItem_checkoutSessionId_fkey1" FOREIGN KEY ("checkoutSessionId") REFERENCES "public"."AuthCheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedItem" ADD CONSTRAINT "PurchasedItem_activationKeyId_fkey1" FOREIGN KEY ("activationKeyId") REFERENCES "public"."ActivationKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_checkoutSessionId_fkey1" FOREIGN KEY ("checkoutSessionId") REFERENCES "public"."AuthCheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialAccount" ADD CONSTRAINT "FinancialAccount_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "public"."Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialAccount" ADD CONSTRAINT "FinancialAccount_contractId_fkey1" FOREIGN KEY ("contractId") REFERENCES "public"."ContractRecord"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."ContractRecord" ADD CONSTRAINT "ContractRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "public"."Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractRecord" ADD CONSTRAINT "ContractRecord_issuerId_fkey1" FOREIGN KEY ("issuerUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractRecord" ADD CONSTRAINT "ContractRecord_holdingUserId_fkey1" FOREIGN KEY ("holdingUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractInvoice" ADD CONSTRAINT "ContractInvoice_contractId_fkey1" FOREIGN KEY ("contractId") REFERENCES "public"."ContractRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalPayout" ADD CONSTRAINT "ExternalPayout_invoiceId_fkey1" FOREIGN KEY ("invoiceId") REFERENCES "public"."ContractInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalPayout" ADD CONSTRAINT "ExternalPayout_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
