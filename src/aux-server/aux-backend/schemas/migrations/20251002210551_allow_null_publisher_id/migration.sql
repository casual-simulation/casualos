-- DropForeignKey
ALTER TABLE "public"."FileRecord" DROP CONSTRAINT "FileRecord_publisherId_fkey";

-- AlterTable
ALTER TABLE "public"."FileRecord" ALTER COLUMN "publisherId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."FileRecord" ADD CONSTRAINT "FileRecord_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
