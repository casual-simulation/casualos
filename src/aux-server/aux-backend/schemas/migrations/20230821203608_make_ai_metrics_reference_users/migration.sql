/*
  Warnings:

  - You are about to drop the column `subscriptionId` on the `AiChatMetrics` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionId` on the `AiImageMetrics` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionId` on the `AiSkyboxMetrics` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "AiChatMetrics" DROP CONSTRAINT "AiChatMetrics_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "AiImageMetrics" DROP CONSTRAINT "AiImageMetrics_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "AiSkyboxMetrics" DROP CONSTRAINT "AiSkyboxMetrics_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "AiChatMetrics" DROP COLUMN "subscriptionId";
ALTER TABLE "AiChatMetrics" ADD COLUMN     "studioId" STRING;
ALTER TABLE "AiChatMetrics" ADD COLUMN     "userId" STRING;

-- AlterTable
ALTER TABLE "AiImageMetrics" DROP COLUMN "subscriptionId";
ALTER TABLE "AiImageMetrics" ADD COLUMN     "studioId" STRING;
ALTER TABLE "AiImageMetrics" ADD COLUMN     "userId" STRING;

-- AlterTable
ALTER TABLE "AiSkyboxMetrics" DROP COLUMN "subscriptionId";
ALTER TABLE "AiSkyboxMetrics" ADD COLUMN     "studioId" STRING;
ALTER TABLE "AiSkyboxMetrics" ADD COLUMN     "userId" STRING;

-- AddForeignKey
ALTER TABLE "AiChatMetrics" ADD CONSTRAINT "AiChatMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMetrics" ADD CONSTRAINT "AiChatMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiImageMetrics" ADD CONSTRAINT "AiImageMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiImageMetrics" ADD CONSTRAINT "AiImageMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkyboxMetrics" ADD CONSTRAINT "AiSkyboxMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSkyboxMetrics" ADD CONSTRAINT "AiSkyboxMetrics_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
