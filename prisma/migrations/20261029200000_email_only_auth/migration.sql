DROP INDEX IF EXISTS "User_usernameNormalized_key";

ALTER TABLE "User"
DROP COLUMN "usernameNormalized",
DROP COLUMN "passwordHash";