-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "login" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Well" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "posX" REAL NOT NULL,
    "posY" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "containerCode" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "sampledAt" DATETIME NOT NULL,
    "collectedById" TEXT NOT NULL,
    "weather" TEXT NOT NULL,
    "waterTempC" REAL NOT NULL,
    "chlorineSmell" BOOLEAN NOT NULL DEFAULT false,
    "visualNote" TEXT NOT NULL,
    "sealCode" TEXT NOT NULL,
    "sealPhotoPath" TEXT NOT NULL,
    "sealIntactAtCollect" BOOLEAN NOT NULL DEFAULT true,
    "coldChainRequired" BOOLEAN NOT NULL DEFAULT true,
    "retestOfId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COLLECTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sample_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "Well" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sample_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sample_retestOfId_fkey" FOREIGN KEY ("retestOfId") REFERENCES "Sample" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "fromUserId" TEXT,
    "approverId" TEXT,
    "sealIntact" BOOLEAN NOT NULL,
    "coldChainOk" BOOLEAN,
    "note" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Handover_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Handover_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Handover_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "indicators" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "qualified" BOOLEAN NOT NULL,
    "abnormalItem" TEXT,
    "testedAt" DATETIME NOT NULL,
    "recordedById" TEXT NOT NULL,
    "correctionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabResult_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LabResult_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "resultId" TEXT,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "officialId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Decision_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "LabResult" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Decision_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "wellId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawnAt" DATETIME,
    CONSTRAINT "Announcement_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Announcement_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "Well" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Announcement_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Well_code_key" ON "Well"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_containerCode_key" ON "Sample"("containerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_batchNo_key" ON "Sample"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_retestOfId_key" ON "Sample"("retestOfId");

-- CreateIndex
CREATE INDEX "Sample_wellId_sampledAt_idx" ON "Sample"("wellId", "sampledAt");

-- CreateIndex
CREATE INDEX "Handover_sampleId_seq_idx" ON "Handover"("sampleId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_sampleId_seq_key" ON "Handover"("sampleId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_sampleId_version_key" ON "LabResult"("sampleId", "version");

-- CreateIndex
CREATE INDEX "Decision_sampleId_createdAt_idx" ON "Decision"("sampleId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_wellId_idx" ON "Announcement"("wellId");
