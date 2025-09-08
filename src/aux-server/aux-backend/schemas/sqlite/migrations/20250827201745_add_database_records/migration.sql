-- CreateTable
CREATE TABLE "DatabaseRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databaseProvider" TEXT NOT NULL,
    "tursoDatabaseId" TEXT NOT NULL,
    "tursoOrganization" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "DatabaseRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);
