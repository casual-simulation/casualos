-- CreateTable
CREATE TABLE "ResourcePermissionAssignment" (
    "id" UUID NOT NULL,
    "recordName" STRING NOT NULL,
    "resourceKind" STRING NOT NULL,
    "resourceId" STRING NOT NULL,
    "action" STRING,
    "options" JSONB,
    "subjectId" STRING NOT NULL,
    "subjectType" STRING NOT NULL,
    "userId" STRING,
    "expireTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourcePermissionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkerPermissionAssignment" (
    "id" UUID NOT NULL,
    "recordName" STRING NOT NULL,
    "marker" STRING(128) NOT NULL,
    "resourceKind" STRING,
    "action" STRING,
    "options" JSONB,
    "subjectId" STRING NOT NULL,
    "subjectType" STRING NOT NULL,
    "userId" STRING,
    "expireTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkerPermissionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourcePermissionAssignment_subjectType_subjectId_recordNa_idx" ON "ResourcePermissionAssignment"("subjectType", "subjectId", "recordName");

-- CreateIndex
CREATE INDEX "ResourcePermissionAssignment_recordName_resourceKind_resour_idx" ON "ResourcePermissionAssignment"("recordName", "resourceKind", "resourceId", "action", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "MarkerPermissionAssignment_subjectType_subjectId_recordName_idx" ON "MarkerPermissionAssignment"("subjectType", "subjectId", "recordName");

-- CreateIndex
CREATE INDEX "MarkerPermissionAssignment_recordName_marker_action_subject_idx" ON "MarkerPermissionAssignment"("recordName", "marker", "action", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "ResourcePermissionAssignment" ADD CONSTRAINT "ResourcePermissionAssignment_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePermissionAssignment" ADD CONSTRAINT "ResourcePermissionAssignment_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkerPermissionAssignment" ADD CONSTRAINT "MarkerPermissionAssignment_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkerPermissionAssignment" ADD CONSTRAINT "MarkerPermissionAssignment_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
