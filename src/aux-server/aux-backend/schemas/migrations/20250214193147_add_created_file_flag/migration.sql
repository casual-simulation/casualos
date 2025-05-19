/*
  Warnings:

  - Added the required column `createdFile` to the `PackageRecordVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PackageRecordVersion" ADD COLUMN     "createdFile" BOOL NOT NULL;
