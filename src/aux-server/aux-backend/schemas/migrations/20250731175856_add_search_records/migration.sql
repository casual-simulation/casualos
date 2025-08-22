-- CreateTable
CREATE TABLE "SearchRecord" (
    "recordName" STRING(128) NOT NULL,
    "address" STRING(100) NOT NULL,
    "collectionName" STRING(128) NOT NULL,
    "searchApiKey" STRING(128) NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateTable
CREATE TABLE "SearchRecordSync" (
    "id" UUID NOT NULL,
    "searchRecordName" STRING(128) NOT NULL,
    "searchRecordAddress" STRING(128) NOT NULL,
    "targetRecordName" STRING(128) NOT NULL,
    "targetResourceKind" STRING(32) NOT NULL,
    "targetMarker" STRING(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchRecordSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRecordSyncHistory" (
    "id" UUID NOT NULL,
    "searchRecordName" STRING(128) NOT NULL,
    "searchRecordAddress" STRING(128) NOT NULL,
    "syncId" UUID NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "status" STRING(32) NOT NULL,
    "success" BOOL NOT NULL,
    "numAdded" INT4 NOT NULL,
    "numUpdated" INT4 NOT NULL,
    "numDeleted" INT4 NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchRecordSyncHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SearchRecord" ADD CONSTRAINT "SearchRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRecordSync" ADD CONSTRAINT "SearchRecordSync_searchRecord_fkey1" FOREIGN KEY ("searchRecordName", "searchRecordAddress") REFERENCES "SearchRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRecordSyncHistory" ADD CONSTRAINT "SearchRecordSyncHistory_sync_fkey1" FOREIGN KEY ("syncId") REFERENCES "SearchRecordSync"("id") ON DELETE CASCADE ON UPDATE CASCADE;
