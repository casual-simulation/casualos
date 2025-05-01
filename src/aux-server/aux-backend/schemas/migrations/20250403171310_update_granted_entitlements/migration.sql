/*
  Warnings:

  - You are about to drop the column `designatedRecords` on the `GrantedPackageEntitlement` table. All the data in the column will be lost.
  - You are about to drop the column `packageAddress` on the `GrantedPackageEntitlement` table. All the data in the column will be lost.
  - You are about to drop the column `packageRecordName` on the `GrantedPackageEntitlement` table. All the data in the column will be lost.
  - Added the required column `packageId` to the `GrantedPackageEntitlement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recordName` to the `GrantedPackageEntitlement` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GrantedPackageEntitlement" DROP CONSTRAINT "GrantedPackageEntitlement_packageAddress_fkey1";

-- DropForeignKey
ALTER TABLE "GrantedPackageEntitlement" DROP CONSTRAINT "GrantedPackageEntitlement_packageRecordName_fkey1";

-- AlterTable
ALTER TABLE "GrantedPackageEntitlement" DROP COLUMN "designatedRecords";
ALTER TABLE "GrantedPackageEntitlement" DROP COLUMN "packageAddress";
ALTER TABLE "GrantedPackageEntitlement" DROP COLUMN "packageRecordName";
ALTER TABLE "GrantedPackageEntitlement" ADD COLUMN     "packageId" UUID NOT NULL;
ALTER TABLE "GrantedPackageEntitlement" ADD COLUMN     "recordName" STRING NOT NULL;
ALTER TABLE "GrantedPackageEntitlement" ADD COLUMN     "revokeTime" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "GrantedPackageEntitlement" ADD CONSTRAINT "GrantedPackageEntitlement_packageId_fkey1" FOREIGN KEY ("packageId") REFERENCES "PackageRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantedPackageEntitlement" ADD CONSTRAINT "GrantedPackageEntitlement_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;
