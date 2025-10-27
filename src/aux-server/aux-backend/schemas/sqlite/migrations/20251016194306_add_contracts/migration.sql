/*
  Warnings:

  - A unique constraint covering the columns `[stripeAccountId]` on the table `Studio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Studio" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "Studio" ADD COLUMN "stripeAccountRequirementsStatus" TEXT;
ALTER TABLE "Studio" ADD COLUMN "stripeAccountStatus" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "requestedRate" INTEGER;
ALTER TABLE "User" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeAccountRequirementsStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeAccountStatus" TEXT;

-- CreateTable
CREATE TABLE "PurchasableItemRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrls" JSONB NOT NULL,
    "currency" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "taxCode" TEXT,
    "roleName" TEXT NOT NULL,
    "roleGrantTimeMs" INTEGER,
    "markers" JSONB NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "PurchasableItemRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthCheckoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paid" BOOLEAN NOT NULL,
    "fulfilledAt" DECIMAL,
    "items" JSONB NOT NULL,
    "stripeStatus" TEXT NOT NULL,
    "stripePaymentStatus" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "userId" TEXT,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "AuthCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchasedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "userId" TEXT,
    "purchasableItemAddress" TEXT NOT NULL,
    "checkoutSessionId" TEXT,
    "roleName" TEXT NOT NULL,
    "roleGrantTimeMs" INTEGER,
    "activatedTime" DECIMAL,
    "activationKeyId" TEXT,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "PurchasedItem_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchasedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchasedItem_recordName_purchasableItemAddress_fkey" FOREIGN KEY ("recordName", "purchasableItemAddress") REFERENCES "PurchasableItemRecord" ("recordName", "address") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchasedItem_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "AuthCheckoutSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchasedItem_activationKeyId_fkey" FOREIGN KEY ("activationKeyId") REFERENCES "ActivationKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivationKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secretHash" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "studioId" TEXT,
    "contractId" TEXT,
    "ledger" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialAccount_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialAccount_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ContractRecord" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "ContractRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "issuerUserId" TEXT NOT NULL,
    "holdingUserId" TEXT NOT NULL,
    "rate" INTEGER NOT NULL,
    "initialValue" INTEGER NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "issuedAt" DECIMAL NOT NULL,
    "closedAt" DECIMAL,
    "markers" JSONB NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "ContractRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractRecord_issuerUserId_fkey" FOREIGN KEY ("issuerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractRecord_holdingUserId_fkey" FOREIGN KEY ("holdingUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "payoutDestination" TEXT NOT NULL,
    "voidReason" TEXT,
    "transactionId" TEXT,
    "note" TEXT,
    "openedAt" DECIMAL NOT NULL,
    "paidAt" DECIMAL,
    "voidedAt" DECIMAL,
    "externalPayoutId" TEXT,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "ContractInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ContractRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT,
    "userId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "externalDestination" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "destinationStripeAccountId" TEXT,
    "amount" INTEGER NOT NULL,
    "postedTransferId" TEXT,
    "voidedTransferId" TEXT,
    "initiatedAt" DECIMAL NOT NULL,
    "postedAt" DECIMAL,
    "voidedAt" DECIMAL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "ExternalPayout_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ContractInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExternalPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeInvoiceId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "checkoutSessionId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL,
    "currency" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER,
    "stripeHostedInvoiceUrl" TEXT NOT NULL,
    "stripeInvoicePdfUrl" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SubscriptionPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "AuthCheckoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("createdAt", "currency", "description", "id", "paid", "periodId", "status", "stripeHostedInvoiceUrl", "stripeInvoiceId", "stripeInvoicePdfUrl", "subscriptionId", "subtotal", "tax", "total", "updatedAt") SELECT "createdAt", "currency", "description", "id", "paid", "periodId", "status", "stripeHostedInvoiceUrl", "stripeInvoiceId", "stripeInvoicePdfUrl", "subscriptionId", "subtotal", "tax", "total", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");
CREATE UNIQUE INDEX "Invoice_periodId_key" ON "Invoice"("periodId");
CREATE UNIQUE INDEX "Invoice_checkoutSessionId_key" ON "Invoice"("checkoutSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AuthCheckoutSession_stripeCheckoutSessionId_key" ON "AuthCheckoutSession"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthCheckoutSession_invoiceId_key" ON "AuthCheckoutSession"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_contractId_key" ON "FinancialAccount"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_userId_studioId_contractId_ledger_key" ON "FinancialAccount"("userId", "studioId", "contractId", "ledger");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRecord_stripeCheckoutSessionId_key" ON "ContractRecord"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRecord_stripePaymentIntentId_key" ON "ContractRecord"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRecord_recordName_address_key" ON "ContractRecord"("recordName", "address");

-- CreateIndex
CREATE UNIQUE INDEX "ContractInvoice_externalPayoutId_key" ON "ContractInvoice"("externalPayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayout_invoiceId_key" ON "ExternalPayout"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayout_transferId_key" ON "ExternalPayout"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeAccountId_key" ON "Studio"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");
