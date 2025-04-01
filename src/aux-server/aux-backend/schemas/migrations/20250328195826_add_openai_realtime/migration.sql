-- CreateTable
CREATE TABLE "AiOpenAIRealtimeMetrics" (
    "sessionId" UUID NOT NULL,
    "request" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" STRING,
    "studioId" STRING,

    CONSTRAINT "AiOpenAIRealtimeMetrics_pkey" PRIMARY KEY ("sessionId")
);

-- AddForeignKey
ALTER TABLE "AiOpenAIRealtimeMetrics" ADD CONSTRAINT "AiOpenAIRealtimeMetrics_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiOpenAIRealtimeMetrics" ADD CONSTRAINT "AiOpenAIRealtimeMetrics_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
