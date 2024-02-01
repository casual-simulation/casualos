-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "ownerStudioComId" STRING;

-- AddForeignKey
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_ownerStudioComId_fkey1" FOREIGN KEY ("ownerStudioComId") REFERENCES "Studio"("comId") ON DELETE SET NULL ON UPDATE CASCADE;
