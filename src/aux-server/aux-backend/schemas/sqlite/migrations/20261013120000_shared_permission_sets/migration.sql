-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SharedPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    "expireTime" DECIMAL,
    "recipientRecordName" TEXT,
    "recipientUserId" TEXT,
    "requestingPermissionAssignmentIds" JSONB NOT NULL,
    "recipientPermissionAssignmentIds" JSONB NOT NULL,
    CONSTRAINT "SharedPermission_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_recipientRecordName_fkey" FOREIGN KEY ("recipientRecordName") REFERENCES "Record" ("name") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SharedPermission_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Convert each existing shared permission into a set that contains its single permission.
INSERT INTO "new_SharedPermission" ("createdAt", "expireTime", "id", "permissions", "recipientPermissionAssignmentIds", "recipientRecordName", "recipientUserId", "recordName", "requestingPermissionAssignmentIds", "requestingUserId", "status", "targetUserId", "updatedAt") SELECT "createdAt", "expireTime", "id", json_array(json("permission")), CASE WHEN "recipientPermissionAssignmentId" IS NULL THEN json_array() ELSE json_array("recipientPermissionAssignmentId") END, "recipientRecordName", "recipientUserId", "recordName", CASE WHEN "requestingPermissionAssignmentId" IS NULL THEN json_array() ELSE json_array("requestingPermissionAssignmentId") END, "requestingUserId", "status", "targetUserId", "updatedAt" FROM "SharedPermission";
DROP TABLE "SharedPermission";
ALTER TABLE "new_SharedPermission" RENAME TO "SharedPermission";
CREATE INDEX "SharedPermission_requestingUserId_idx" ON "SharedPermission"("requestingUserId");
CREATE INDEX "SharedPermission_targetUserId_idx" ON "SharedPermission"("targetUserId");
CREATE INDEX "SharedPermission_recipientUserId_idx" ON "SharedPermission"("recipientUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
