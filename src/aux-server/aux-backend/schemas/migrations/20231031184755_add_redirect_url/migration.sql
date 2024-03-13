/*
  Warnings:

  - Added the required column `redirectUrl` to the `OpenIDLoginRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OpenIDLoginRequest" ADD COLUMN     "redirectUrl" STRING NOT NULL;
