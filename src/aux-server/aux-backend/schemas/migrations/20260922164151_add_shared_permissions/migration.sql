-- CreateTable
CREATE TABLE "public"."SharedPermission" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "requestingUserId" STRING NOT NULL,
    "targetUserId" STRING,
    "permission" JSONB NOT NULL,
    "status" STRING(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expireTime" TIMESTAMP(3),
    "recipientRecordName" STRING(128),
    "recipientUserId" STRING,
    "requestingPermissionAssignmentId" UUID,
    "recipientPermissionAssignmentId" UUID,

    CONSTRAINT "SharedPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedPermission_requestingUserId_idx" ON "public"."SharedPermission"("requestingUserId");

-- CreateIndex
CREATE INDEX "SharedPermission_targetUserId_idx" ON "public"."SharedPermission"("targetUserId");

-- CreateIndex
CREATE INDEX "SharedPermission_recipientUserId_idx" ON "public"."SharedPermission"("recipientUserId");

-- AddForeignKey
ALTER TABLE "public"."SharedPermission" ADD CONSTRAINT "SharedPermission_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "public"."Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SharedPermission" ADD CONSTRAINT "SharedPermission_requestingUserId_fkey1" FOREIGN KEY ("requestingUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SharedPermission" ADD CONSTRAINT "SharedPermission_targetUserId_fkey1" FOREIGN KEY ("targetUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SharedPermission" ADD CONSTRAINT "SharedPermission_recipientRecordName_fkey1" FOREIGN KEY ("recipientRecordName") REFERENCES "public"."Record"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SharedPermission" ADD CONSTRAINT "SharedPermission_recipientUserId_fkey1" FOREIGN KEY ("recipientUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
