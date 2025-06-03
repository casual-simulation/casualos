-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isXpAdmin" BOOL;

-- CreateTable
CREATE TABLE "XpUser" (
    "id" UUID NOT NULL,
    "userId" STRING NOT NULL,
    "accountId" UUID NOT NULL,
    "requestedRate" INT4 NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpAccount" (
    "id" UUID NOT NULL,
    "currency" STRING NOT NULL,
    "closedTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpAccountEntry" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "amount" INT4 NOT NULL,
    "balance" INT4 NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "transactionId" UUID NOT NULL,
    "note" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpAccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpContract" (
    "id" UUID NOT NULL,
    "issuerUserId" STRING NOT NULL,
    "holdingUserId" STRING NOT NULL,
    "rate" INT4 NOT NULL,
    "description" STRING NOT NULL,
    "status" STRING NOT NULL,
    "accountId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpInvoice" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "amount" INT4 NOT NULL,
    "status" STRING NOT NULL,
    "voidReason" STRING,
    "transactionId" UUID,
    "note" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XpUser_userId_key" ON "XpUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "XpUser_accountId_key" ON "XpUser"("accountId");

-- CreateIndex
CREATE INDEX "XpAccountEntry_transactionId_idx" ON "XpAccountEntry"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "XpContract_accountId_key" ON "XpContract"("accountId");

-- AddForeignKey
ALTER TABLE "XpUser" ADD CONSTRAINT "XpUser_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpUser" ADD CONSTRAINT "XpUser_accountId_fkey1" FOREIGN KEY ("accountId") REFERENCES "XpAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAccountEntry" ADD CONSTRAINT "XpAccountEntry_accountId_fkey1" FOREIGN KEY ("accountId") REFERENCES "XpAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpContract" ADD CONSTRAINT "XpContract_issuerId_fkey1" FOREIGN KEY ("issuerUserId") REFERENCES "XpUser"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpContract" ADD CONSTRAINT "XpContract_holdingUserId_fkey1" FOREIGN KEY ("holdingUserId") REFERENCES "XpUser"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpContract" ADD CONSTRAINT "XpContract_accountId_fkey1" FOREIGN KEY ("accountId") REFERENCES "XpAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpInvoice" ADD CONSTRAINT "XpInvoice_contractId_fkey1" FOREIGN KEY ("contractId") REFERENCES "XpContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
