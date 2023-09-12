-- DropForeignKey
ALTER TABLE "BranchUpdate" DROP CONSTRAINT "BranchUpdate_recordName_fkey";

-- DropForeignKey
ALTER TABLE "BranchUpdate" DROP CONSTRAINT "BranchUpdate_recordName_instName_branchName_fkey";

-- DropForeignKey
ALTER TABLE "BranchUpdate" DROP CONSTRAINT "BranchUpdate_recordName_instName_fkey";

-- DropForeignKey
ALTER TABLE "InstBranch" DROP CONSTRAINT "InstBranch_recordName_fkey";

-- DropForeignKey
ALTER TABLE "InstBranch" DROP CONSTRAINT "InstBranch_recordName_instName_fkey";

-- DropForeignKey
ALTER TABLE "InstRecord" DROP CONSTRAINT "InstRecord_recordName_fkey";

-- AddForeignKey
ALTER TABLE "InstRecord" ADD CONSTRAINT "InstRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstBranch" ADD CONSTRAINT "InstBranch_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstBranch" ADD CONSTRAINT "InstBranch_recordName_instName_fkey" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord"("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_recordName_instName_fkey" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord"("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_recordName_instName_branchName_fkey" FOREIGN KEY ("recordName", "instName", "branchName") REFERENCES "InstBranch"("recordName", "instName", "name") ON DELETE CASCADE ON UPDATE CASCADE;
