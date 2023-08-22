/*
  Warnings:

  - You are about to drop the column `pixelsGenerated` on the `AiImageMetrics` table. All the data in the column will be lost.
  - Added the required column `squarePixelsGenerated` to the `AiImageMetrics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AiImageMetrics" DROP COLUMN "pixelsGenerated";
ALTER TABLE "AiImageMetrics" ADD COLUMN     "squarePixelsGenerated" INT4 NOT NULL;
