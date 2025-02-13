-- CreateTable
CREATE TABLE "GrantedPackageEntitlement" (
    "id" UUID NOT NULL,
    "userId" STRING NOT NULL,
    "packageRecordName" STRING(128) NOT NULL,
    "packageAddress" STRING(128) NOT NULL,
    "feature" STRING(32) NOT NULL,
    "scope" STRING(32) NOT NULL,
    "expireTime" TIMESTAMP(3) NOT NULL,
    "designatedRecords" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantedPackageEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadedPackage" (
    "id" UUID NOT NULL,
    "userId" STRING,
    "packageId" UUID NOT NULL,
    "packageVersionId" UUID NOT NULL,
    "instRecordName" STRING(128) NOT NULL,
    "instName" STRING(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadedPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRecord" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "address" STRING(128) NOT NULL,
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRecordVersion" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "address" STRING(128) NOT NULL,
    "major" INT4 NOT NULL,
    "minor" INT4 NOT NULL,
    "patch" INT4 NOT NULL,
    "tag" STRING(16),
    "sha256" STRING(64) NOT NULL,
    "auxSha256" STRING(64) NOT NULL,
    "auxFileName" STRING NOT NULL,
    "entitlements" JSONB NOT NULL,
    "requiresReview" BOOL NOT NULL,
    "readme" STRING NOT NULL,
    "sizeInBytes" INT4 NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageRecordVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRecordVersionReview" (
    "id" UUID NOT NULL,
    "packageVersionId" UUID NOT NULL,
    "approved" BOOL NOT NULL,
    "approvalType" STRING,
    "reviewStatus" STRING NOT NULL,
    "reviewComments" STRING(4096) NOT NULL,
    "reviewingUserId" STRING(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageRecordVersionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageRecord_recordName_address_key" ON "PackageRecord"("recordName", "address");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRecordVersion_sha256_key" ON "PackageRecordVersion"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRecordVersion_recordName_address_major_minor_patch_t_key" ON "PackageRecordVersion"("recordName", "address", "major", "minor", "patch", "tag");

-- AddForeignKey
ALTER TABLE "GrantedPackageEntitlement" ADD CONSTRAINT "GrantedPackageEntitlement_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantedPackageEntitlement" ADD CONSTRAINT "GrantedPackageEntitlement_packageRecordName_fkey1" FOREIGN KEY ("packageRecordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantedPackageEntitlement" ADD CONSTRAINT "GrantedPackageEntitlement_packageAddress_fkey1" FOREIGN KEY ("packageRecordName", "packageAddress") REFERENCES "PackageRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadedPackage" ADD CONSTRAINT "LoadedPackage_user_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadedPackage" ADD CONSTRAINT "LoadedPackage_packageId_fkey1" FOREIGN KEY ("packageId") REFERENCES "PackageRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadedPackage" ADD CONSTRAINT "LoadedPackage_packageVersionId_fkey1" FOREIGN KEY ("packageVersionId") REFERENCES "PackageRecordVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadedPackage" ADD CONSTRAINT "LoadedPackage_inst_fkey1" FOREIGN KEY ("instRecordName", "instName") REFERENCES "InstRecord"("recordName", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRecord" ADD CONSTRAINT "PackageRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRecordVersion" ADD CONSTRAINT "PackageRecordVersion_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRecordVersion" ADD CONSTRAINT "PackageRecordVersion_address_fkey1" FOREIGN KEY ("recordName", "address") REFERENCES "PackageRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRecordVersion" ADD CONSTRAINT "PackageRecordVersion_auxFileName_fkey1" FOREIGN KEY ("recordName", "auxFileName") REFERENCES "FileRecord"("recordName", "fileName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRecordVersionReview" ADD CONSTRAINT "PackageRecordVersionReview_packageVersionId_fkey1" FOREIGN KEY ("packageVersionId") REFERENCES "PackageRecordVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRecordVersionReview" ADD CONSTRAINT "PackageRecordVersionReview_reviewingUserId_fkey1" FOREIGN KEY ("reviewingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
