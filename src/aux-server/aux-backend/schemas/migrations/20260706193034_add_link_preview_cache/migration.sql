-- CreateTable
CREATE TABLE "public"."LinkPreviewCache" (
    "cacheKey" STRING NOT NULL,
    "data" JSONB NOT NULL,
    "expireAtMs" INT8 NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPreviewCache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateIndex
CREATE INDEX "LinkPreviewCache_expireAtMs_idx" ON "public"."LinkPreviewCache"("expireAtMs");
