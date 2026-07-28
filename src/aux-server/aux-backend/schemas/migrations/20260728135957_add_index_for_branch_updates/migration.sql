-- CreateIndex
CREATE INDEX "BranchUpdate_recordName_instName_branchName_createdAt_sizeI_idx" ON "public"."BranchUpdate"("recordName", "instName", "branchName", "createdAt", "sizeInBytes");
