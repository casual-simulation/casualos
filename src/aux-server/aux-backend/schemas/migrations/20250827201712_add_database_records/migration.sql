-- CreateTable
CREATE TABLE "public"."DatabaseRecord" (
    "recordName" STRING(128) NOT NULL,
    "address" STRING(100) NOT NULL,
    "databaseName" STRING(32) NOT NULL,
    "databaseProvider" STRING NOT NULL,
    "databaseInfo" JSONB NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- AddForeignKey
ALTER TABLE "public"."DatabaseRecord" ADD CONSTRAINT "DatabaseRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "public"."Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;
