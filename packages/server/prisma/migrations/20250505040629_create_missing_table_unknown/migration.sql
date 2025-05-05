-- CreateTable
CREATE TABLE "TVSettings" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "authToken" TEXT,
    "port" INTEGER DEFAULT 7345,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TVSettings_pkey" PRIMARY KEY ("id")
);
