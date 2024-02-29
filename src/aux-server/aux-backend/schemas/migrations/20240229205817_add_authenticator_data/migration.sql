/*
  Warnings:

  - Added the required column `aaguid` to the `UserAuthenticator` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserAuthenticator" ADD COLUMN     "aaguid" UUID NOT NULL;
ALTER TABLE "UserAuthenticator" ADD COLUMN     "registeringUserAgent" STRING(512);
