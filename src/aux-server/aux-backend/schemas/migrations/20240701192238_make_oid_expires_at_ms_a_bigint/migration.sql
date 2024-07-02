/*
  Warnings:

  - The `oidExpiresAtMs` column on the `AuthSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "AuthSession" ALTER COLUMN "oidExpiresAtMs" TYPE INT8;
