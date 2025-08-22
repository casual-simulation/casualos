/*
  Warnings:

  - A unique constraint covering the columns `[searchRecordName,searchRecordAddress,targetRecordName,targetResourceKind,targetMarker]` on the table `SearchRecordSync` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SearchRecordSync_searchRecordName_searchRecordAddress_targe_key" ON "SearchRecordSync"("searchRecordName", "searchRecordAddress", "targetRecordName", "targetResourceKind", "targetMarker");
