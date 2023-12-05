/*
  Warnings:

  - You are about to drop the column `allowPublishPublicData` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "allowPublishPublicData";
ALTER TABLE "User" ADD COLUMN     "allowPublicData" BOOL;
