/*
  Warnings:

  - Made the column `accountId` on table `XpUser` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "XpUser" ALTER COLUMN "accountId" SET NOT NULL;
