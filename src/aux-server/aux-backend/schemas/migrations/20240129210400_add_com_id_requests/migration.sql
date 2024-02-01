-- CreateTable
CREATE TABLE "StudioComIdRequest" (
    "id" UUID NOT NULL,
    "studioId" STRING NOT NULL,
    "requestedComId" STRING(128) NOT NULL,
    "userId" STRING,
    "requestingIpAddress" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioComIdRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudioComIdRequest" ADD CONSTRAINT "StudioComIdRequest_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioComIdRequest" ADD CONSTRAINT "StudioComIdRequest_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
