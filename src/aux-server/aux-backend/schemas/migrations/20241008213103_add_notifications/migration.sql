-- CreateTable
CREATE TABLE "NotificationRecord" (
    "recordName" STRING(128) NOT NULL,
    "address" STRING(512) NOT NULL,
    "description" STRING(2048),
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "notificationAddress" STRING(512) NOT NULL,
    "active" BOOL NOT NULL,
    "userId" STRING NOT NULL,
    "pushSubscription" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentNotification" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "notificationAddress" STRING(512) NOT NULL,
    "title" STRING(128) NOT NULL,
    "body" STRING(512) NOT NULL,
    "icon" STRING(1024),
    "badge" STRING(1024),
    "silent" BOOL,
    "tag" STRING(128),
    "topic" STRING(128),
    "defaultAction" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "sentTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentNotificationUser" (
    "sentNotificationId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "userId" STRING NOT NULL,
    "success" BOOL NOT NULL,
    "errorCode" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentNotificationUser_pkey" PRIMARY KEY ("sentNotificationId","userId","subscriptionId")
);

-- CreateIndex
CREATE INDEX "NotificationSubscription_recordName_notificationAddress_act_idx" ON "NotificationSubscription"("recordName", "notificationAddress", "active");

-- AddForeignKey
ALTER TABLE "NotificationRecord" ADD CONSTRAINT "NotificationRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_notificationAddress_fkey1" FOREIGN KEY ("recordName", "notificationAddress") REFERENCES "NotificationRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentNotification" ADD CONSTRAINT "SentNotification_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentNotification" ADD CONSTRAINT "SentNotification_notificationAddress_fkey1" FOREIGN KEY ("recordName", "notificationAddress") REFERENCES "NotificationRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentNotificationUser" ADD CONSTRAINT "SentNotificationUser_sentNotificationId_fkey1" FOREIGN KEY ("sentNotificationId") REFERENCES "SentNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentNotificationUser" ADD CONSTRAINT "SentNotificationUser_subscriptionId_fkey1" FOREIGN KEY ("subscriptionId") REFERENCES "NotificationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentNotificationUser" ADD CONSTRAINT "SentNotificationUser_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
