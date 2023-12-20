-- CreateTable
CREATE TABLE "UserInstReport" (
    "id" UUID NOT NULL,
    "recordName" STRING,
    "inst" STRING NOT NULL,
    "reportingUserId" STRING,
    "reportingIpAddress" STRING,
    "automaticReport" BOOL NOT NULL,
    "reportReasonText" STRING NOT NULL,
    "reportReason" STRING NOT NULL,
    "reportedUrl" STRING NOT NULL,
    "reportedPermalink" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInstReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserInstReport_automaticReport_createdAt_recordName_inst_idx" ON "UserInstReport"("automaticReport", "createdAt" DESC, "recordName", "inst");

-- CreateIndex
CREATE INDEX "UserInstReport_reportReason_createdAt_recordName_inst_idx" ON "UserInstReport"("reportReason", "createdAt" DESC, "recordName", "inst");

-- AddForeignKey
ALTER TABLE "UserInstReport" ADD CONSTRAINT "UserInstReport_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstReport" ADD CONSTRAINT "UserInstReport_inst_fkey1" FOREIGN KEY ("recordName", "inst") REFERENCES "InstRecord"("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstReport" ADD CONSTRAINT "UserInstReport_reportingUserId_fkey1" FOREIGN KEY ("reportingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
