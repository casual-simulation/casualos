/*
  Warnings:

  - A unique constraint covering the columns `[subscriptionInfoId]` on the table `Studio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[subscriptionInfoId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "subscriptionInfoId" UUID;
ALTER TABLE "Studio" ADD COLUMN     "subscriptionPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Studio" ADD COLUMN     "subscriptionPeriodStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionInfoId" UUID;
ALTER TABLE "User" ADD COLUMN     "subscriptionPeriodEnd" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "subscriptionPeriodStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "stripeSubscriptionId" STRING NOT NULL,
    "userId" STRING,
    "studioId" STRING,
    "subscriptionStatus" STRING,
    "stripeCustomerId" STRING,
    "subscriptionId" STRING,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPeriod" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "stripeInvoiceId" STRING NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "description" STRING NOT NULL,
    "status" STRING NOT NULL,
    "paid" BOOL NOT NULL,
    "currency" STRING NOT NULL,
    "total" INT4 NOT NULL,
    "subtotal" INT4 NOT NULL,
    "tax" INT4 NOT NULL,
    "stripeHostedInvoiceUrl" STRING NOT NULL,
    "stripeInvoicePdfUrl" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatMetrics" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokens" INT4 NOT NULL,
    "subscriptionId" UUID NOT NULL,

    CONSTRAINT "AiChatMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiImageMetrics" (
    "id" UUID NOT NULL,
    "pixelsGenerated" INT4 NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiImageMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSkyboxMetrics" (
    "id" UUID NOT NULL,
    "skyboxesGenerated" INT4 NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSkyboxMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_studioId_key" ON "Subscription"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPeriod_invoiceId_key" ON "SubscriptionPeriod"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_periodId_key" ON "Invoice"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_subscriptionInfoId_key" ON "Studio"("subscriptionInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_subscriptionInfoId_key" ON "User"("subscriptionInfoId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subscriptionInfoId_fkey" FOREIGN KEY ("subscriptionInfoId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_subscriptionInfoId_fkey" FOREIGN KEY ("subscriptionInfoId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPeriod" ADD CONSTRAINT "SubscriptionPeriod_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SubscriptionPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMetrics" ADD CONSTRAINT "AiChatMetrics_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiImageMetrics" ADD CONSTRAINT "AiImageMetrics_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkyboxMetrics" ADD CONSTRAINT "AiSkyboxMetrics_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
