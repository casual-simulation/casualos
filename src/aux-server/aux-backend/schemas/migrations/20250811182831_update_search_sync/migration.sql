/*
  Warnings:

  - You are about to drop the column `numAdded` on the `SearchRecordSyncHistory` table. All the data in the column will be lost.
  - You are about to drop the column `numDeleted` on the `SearchRecordSyncHistory` table. All the data in the column will be lost.
  - You are about to drop the column `numUpdated` on the `SearchRecordSyncHistory` table. All the data in the column will be lost.
  - Added the required column `targetMapping` to the `SearchRecordSync` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numErrored` to the `SearchRecordSyncHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numSynced` to the `SearchRecordSyncHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `runId` to the `SearchRecordSyncHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SearchRecordSync" ADD COLUMN     "targetMapping" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "SearchRecordSyncHistory" DROP COLUMN "numAdded";
ALTER TABLE "SearchRecordSyncHistory" DROP COLUMN "numDeleted";
ALTER TABLE "SearchRecordSyncHistory" DROP COLUMN "numUpdated";
ALTER TABLE "SearchRecordSyncHistory" ADD COLUMN     "numErrored" INT4 NOT NULL;
ALTER TABLE "SearchRecordSyncHistory" ADD COLUMN     "numSynced" INT4 NOT NULL;
ALTER TABLE "SearchRecordSyncHistory" ADD COLUMN     "runId" UUID NOT NULL;
