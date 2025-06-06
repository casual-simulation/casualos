/*
  Warnings:

  - You are about to drop the column `readme` on the `PackageRecordVersion` table. All the data in the column will be lost.
  - Added the required column `description` to the `PackageRecordVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PackageRecordVersion" DROP COLUMN "readme";
ALTER TABLE "PackageRecordVersion" ADD COLUMN     "description" STRING NOT NULL;
