-- CreateTable
CREATE TABLE "InstRecord" (
    "recordName" STRING NOT NULL,
    "name" STRING NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstRecord_pkey" PRIMARY KEY ("recordName","name")
);

-- CreateTable
CREATE TABLE "InstBranch" (
    "recordName" STRING NOT NULL,
    "instName" STRING NOT NULL,
    "name" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstBranch_pkey" PRIMARY KEY ("recordName","instName","name")
);

-- CreateTable
CREATE TABLE "BranchUpdate" (
    "id" UUID NOT NULL,
    "recordName" STRING NOT NULL,
    "instName" STRING NOT NULL,
    "branchName" STRING NOT NULL,
    "sizeInBytes" INT4 NOT NULL,
    "updateData" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchUpdate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstRecord" ADD CONSTRAINT "InstRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstBranch" ADD CONSTRAINT "InstBranch_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstBranch" ADD CONSTRAINT "InstBranch_recordName_instName_fkey" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord"("recordName", "name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_recordName_instName_fkey" FOREIGN KEY ("recordName", "instName") REFERENCES "InstRecord"("recordName", "name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchUpdate" ADD CONSTRAINT "BranchUpdate_recordName_instName_branchName_fkey" FOREIGN KEY ("recordName", "instName", "branchName") REFERENCES "InstBranch"("recordName", "instName", "name") ON DELETE RESTRICT ON UPDATE CASCADE;
