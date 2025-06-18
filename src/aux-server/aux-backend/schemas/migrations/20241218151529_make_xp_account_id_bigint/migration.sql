/*
  Warnings:

  - The `accountId` column on the `XpContract` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `accountId` on the `XpUser` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "XpContract" DROP COLUMN "accountId";
ALTER TABLE "XpContract" ADD COLUMN     "accountId" INT8;

-- AlterTable
ALTER TABLE "XpUser" DROP COLUMN "accountId";
ALTER TABLE "XpUser" ADD COLUMN     "accountId" INT8 NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "XpContract_accountId_key" ON "XpContract"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "XpUser_accountId_key" ON "XpUser"("accountId");
