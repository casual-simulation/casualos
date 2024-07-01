-- CreateTable
CREATE TABLE "AiSloydMetrics" (
    "id" UUID NOT NULL,
    "modelsCreated" INT4 NOT NULL,
    "name" STRING NOT NULL,
    "confidence" FLOAT8 NOT NULL,
    "mimeType" STRING NOT NULL,
    "modelData" STRING NOT NULL,
    "thumbnailBase64" STRING,
    "baseModelId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" STRING,
    "studioId" STRING,

    CONSTRAINT "AiSloydMetrics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AiSloydMetrics" ADD CONSTRAINT "AiSloydMetrics_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSloydMetrics" ADD CONSTRAINT "AiSloydMetrics_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
