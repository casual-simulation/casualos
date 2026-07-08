-- CreateTable
CREATE TABLE "LinkPreviewCache" (
    "cacheKey" TEXT NOT NULL PRIMARY KEY,
    "data" JSONB NOT NULL,
    "expireAtMs" BIGINT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL
);

-- CreateIndex
CREATE INDEX "LinkPreviewCache_expireAtMs_idx" ON "LinkPreviewCache"("expireAtMs");
