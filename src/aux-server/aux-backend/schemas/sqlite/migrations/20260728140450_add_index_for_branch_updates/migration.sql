-- CreateIndex
CREATE INDEX "BranchUpdate_recordName_instName_branchName_createdAt_sizeInBytes_idx" ON "BranchUpdate"("recordName", "instName", "branchName", "createdAt", "sizeInBytes");
