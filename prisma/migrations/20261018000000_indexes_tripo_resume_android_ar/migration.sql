-- AlterTable
ALTER TABLE "MenuItemAsset" DROP COLUMN "polyCount",
DROP COLUMN "textureSize",
ADD COLUMN     "arGlbUrl" TEXT;

-- AlterTable
ALTER TABLE "ProcessingJob" DROP COLUMN "logsUrl",
ADD COLUMN     "tripoBaseTaskId" TEXT,
ADD COLUMN     "tripoLowpolyTaskId" TEXT,
ADD COLUMN     "tripoUsdzTaskId" TEXT;

-- CreateIndex
CREATE INDEX "MenuCategory_restaurantId_sortOrder_idx" ON "MenuCategory"("restaurantId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItemMedia_itemId_sortOrder_idx" ON "MenuItemMedia"("itemId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItemAsset_itemId_version_idx" ON "MenuItemAsset"("itemId", "version");

-- CreateIndex
CREATE INDEX "ProcessingJob_itemId_createdAt_idx" ON "ProcessingJob"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_restaurantId_createdAt_idx" ON "AnalyticsEvent"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

