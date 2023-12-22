-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privoParentServiceId" STRING;
ALTER TABLE "User" ADD COLUMN     "privoServiceId" STRING;

-- CreateIndex
CREATE UNIQUE INDEX "User_privoServiceId_key" ON "User"("privoServiceId");