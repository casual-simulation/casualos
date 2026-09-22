-- CreateTable
CREATE TABLE "ProxyRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "ProxyRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProxyRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordName" TEXT NOT NULL,
    "proxyAddress" TEXT NOT NULL,
    "requestTime" DECIMAL NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    CONSTRAINT "ProxyRequest_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProxyRequest_recordName_proxyAddress_fkey" FOREIGN KEY ("recordName", "proxyAddress") REFERENCES "ProxyRecord" ("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProxyRequest_requestTime_idx" ON "ProxyRequest"("requestTime");
