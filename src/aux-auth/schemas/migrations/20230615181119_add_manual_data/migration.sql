-- CreateTable
CREATE TABLE "ManualDataRecord" (
    "recordName" STRING NOT NULL,
    "address" STRING NOT NULL,
    "data" JSONB NOT NULL,
    "publisherId" STRING NOT NULL,
    "subjectId" STRING NOT NULL,
    "updatePolicy" JSONB NOT NULL,
    "deletePolicy" JSONB NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualDataRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateIndex
CREATE INDEX "RoleAssignment_recordName_subjectId_idx" ON "RoleAssignment"("recordName", "subjectId");

-- CreateIndex
CREATE INDEX "RoleAssignment_recordName_roleId_idx" ON "RoleAssignment"("recordName", "roleId");

-- AddForeignKey
ALTER TABLE "ManualDataRecord" ADD CONSTRAINT "ManualDataRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualDataRecord" ADD CONSTRAINT "ManualDataRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualDataRecord" ADD CONSTRAINT "ManualDataRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
