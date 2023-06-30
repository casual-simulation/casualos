-- DropForeignKey
ALTER TABLE "DataRecord" DROP CONSTRAINT "DataRecord_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "FileRecord" DROP CONSTRAINT "FileRecord_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "ManualDataRecord" DROP CONSTRAINT "ManualDataRecord_subjectId_fkey";

-- AlterTable
ALTER TABLE "DataRecord" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FileRecord" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ManualDataRecord" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualDataRecord" ADD CONSTRAINT "ManualDataRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
