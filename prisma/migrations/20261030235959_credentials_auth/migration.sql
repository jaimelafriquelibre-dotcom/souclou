ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "username" TEXT,
    ADD COLUMN IF NOT EXISTS "usernameNormalized" TEXT,
    ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key"
ON "User"("username");

CREATE UNIQUE INDEX IF NOT EXISTS "User_usernameNormalized_key"
ON "User"("usernameNormalized");