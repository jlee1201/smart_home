-- CreateTable
CREATE TABLE "AVRSettings" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 23,
    "deviceName" TEXT,
    "macAddress" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "lastDiscoveryAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discoveryHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AVRSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AVRSettings_ip_port_key" ON "AVRSettings"("ip", "port");
