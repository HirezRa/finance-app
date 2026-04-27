-- CreateTable
CREATE TABLE "VendorMapping" (
    "id" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "originalNames" TEXT[],
    "categoryId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorMapping_userId_idx" ON "VendorMapping"("userId");

-- CreateIndex
CREATE INDEX "VendorMapping_normalizedName_idx" ON "VendorMapping"("normalizedName");

-- CreateIndex
CREATE INDEX "VendorMapping_categoryId_idx" ON "VendorMapping"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorMapping_userId_normalizedName_key" ON "VendorMapping"("userId", "normalizedName");

-- AddForeignKey
ALTER TABLE "VendorMapping" ADD CONSTRAINT "VendorMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMapping" ADD CONSTRAINT "VendorMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
