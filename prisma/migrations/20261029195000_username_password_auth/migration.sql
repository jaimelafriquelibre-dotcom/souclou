ALTER TABLE "User"
ADD COLUMN "usernameNormalized" TEXT,
ADD COLUMN "passwordHash" VARCHAR(255);

CREATE UNIQUE INDEX "User_usernameNormalized_key"
ON "User"("usernameNormalized");
