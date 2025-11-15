-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FileRecord" (
    "recordName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "publisherId" TEXT,
    "subjectId" TEXT,
    "sizeInBytes" BIGINT NOT NULL,
    "description" TEXT,
    "bucket" TEXT,
    "uploadedAt" DECIMAL,
    "markers" JSONB NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,

    PRIMARY KEY ("recordName", "fileName"),
    CONSTRAINT "FileRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FileRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FileRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FileRecord" ("bucket", "createdAt", "description", "fileName", "markers", "publisherId", "recordName", "sizeInBytes", "subjectId", "updatedAt", "uploadedAt") SELECT "bucket", "createdAt", "description", "fileName", "markers", "publisherId", "recordName", "sizeInBytes", "subjectId", "updatedAt", "uploadedAt" FROM "FileRecord";
DROP TABLE "FileRecord";
ALTER TABLE "new_FileRecord" RENAME TO "FileRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
