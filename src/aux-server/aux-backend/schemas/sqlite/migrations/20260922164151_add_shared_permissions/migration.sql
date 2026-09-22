-- CreateTable
CREATE TABLE "SharedPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "permission" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    "expireTime" DECIMAL,
    "recipientRecordName" TEXT,
    "recipientUserId" TEXT,
    "requestingPermissionAssignmentId" TEXT,
    "recipientPermissionAssignmentId" TEXT,
    CONSTRAINT "SharedPermission_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_recipientRecordName_fkey" FOREIGN KEY ("recipientRecordName") REFERENCES "Record" ("name") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SharedPermission_requestingUserId_idx" ON "SharedPermission"("requestingUserId");

-- CreateIndex
CREATE INDEX "SharedPermission_targetUserId_idx" ON "SharedPermission"("targetUserId");

-- CreateIndex
CREATE INDEX "SharedPermission_recipientUserId_idx" ON "SharedPermission"("recipientUserId");
