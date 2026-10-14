-- Unlock the table so that its schema can be changed.
ALTER TABLE "public"."SharedPermission" SET (schema_locked = false);

-- AlterTable
ALTER TABLE "public"."SharedPermission" ADD COLUMN     "permissions" JSONB;
ALTER TABLE "public"."SharedPermission" ADD COLUMN     "recipientPermissionAssignmentIds" UUID[];
ALTER TABLE "public"."SharedPermission" ADD COLUMN     "requestingPermissionAssignmentIds" UUID[];

-- Convert each existing shared permission into a set that contains its single permission.
UPDATE "public"."SharedPermission" SET
    "permissions" = jsonb_build_array("permission"),
    "requestingPermissionAssignmentIds" = CASE WHEN "requestingPermissionAssignmentId" IS NULL THEN ARRAY[]::UUID[] ELSE ARRAY["requestingPermissionAssignmentId"] END,
    "recipientPermissionAssignmentIds" = CASE WHEN "recipientPermissionAssignmentId" IS NULL THEN ARRAY[]::UUID[] ELSE ARRAY["recipientPermissionAssignmentId"] END;

-- AlterTable
ALTER TABLE "public"."SharedPermission" ALTER COLUMN "permissions" SET NOT NULL;
ALTER TABLE "public"."SharedPermission" DROP COLUMN "permission";
ALTER TABLE "public"."SharedPermission" DROP COLUMN "recipientPermissionAssignmentId";
ALTER TABLE "public"."SharedPermission" DROP COLUMN "requestingPermissionAssignmentId";

-- Lock the table again now that the schema change is complete.
ALTER TABLE "public"."SharedPermission" SET (schema_locked = true);
