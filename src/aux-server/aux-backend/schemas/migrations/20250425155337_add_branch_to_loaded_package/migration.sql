/*
  Warnings:

  - Added the required column `branch` to the `LoadedPackage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LoadedPackage" ADD COLUMN     "branch" STRING(512) NOT NULL;
