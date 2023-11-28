/*
  Warnings:

  - A unique constraint covering the columns `[state]` on the table `OpenIDLoginRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "OpenIDLoginRequest" ADD COLUMN     "state" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "OpenIDLoginRequest_state_key" ON "OpenIDLoginRequest"("state");
