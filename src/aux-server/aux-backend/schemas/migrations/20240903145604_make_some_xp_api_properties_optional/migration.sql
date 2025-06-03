-- AlterTable
ALTER TABLE "XpContract" ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "XpInvoice" ALTER COLUMN "note" DROP NOT NULL;

-- AlterTable
ALTER TABLE "XpUser" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "XpUser" ALTER COLUMN "requestedRate" DROP NOT NULL;
