/*
  Warnings:

  - Added the required column `temporary` to the `InstBranch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InstBranch" ADD COLUMN     "temporary" BOOL NOT NULL;
