/*
  Warnings:

  - Changed the type of `databaseName` on the `DatabaseRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."DatabaseRecord" DROP COLUMN "databaseName";
ALTER TABLE "public"."DatabaseRecord" ADD COLUMN     "databaseName" STRING(100) NOT NULL;
