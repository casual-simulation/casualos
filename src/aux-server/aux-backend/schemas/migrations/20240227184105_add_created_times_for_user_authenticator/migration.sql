/*
  Warnings:

  - Added the required column `updatedAt` to the `UserAuthenticator` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserAuthenticator" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserAuthenticator" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
