-- CreateTable
CREATE TABLE "public"."ProxyRecord" (
    "recordName" STRING(128) NOT NULL,
    "address" STRING(512) NOT NULL,
    "host" STRING(256) NOT NULL,
    "data" JSONB NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProxyRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateTable
CREATE TABLE "public"."ProxyRequest" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "proxyAddress" STRING(512) NOT NULL,
    "requestTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProxyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProxyRequest_requestTime_idx" ON "public"."ProxyRequest"("requestTime");

-- AddForeignKey
ALTER TABLE "public"."ProxyRecord" ADD CONSTRAINT "ProxyRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "public"."Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProxyRequest" ADD CONSTRAINT "ProxyRequest_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "public"."Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProxyRequest" ADD CONSTRAINT "ProxyRequest_proxyAddress_fkey1" FOREIGN KEY ("recordName", "proxyAddress") REFERENCES "public"."ProxyRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;
