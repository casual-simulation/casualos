/*
  Warnings:

  - A unique constraint covering the columns `[comId]` on the table `Studio` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "comId" STRING;
ALTER TABLE "Studio" ADD COLUMN     "logoUrl" STRING;
ALTER TABLE "Studio" ADD COLUMN     "playerConfig" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Studio_comId_key" ON "Studio"("comId");
