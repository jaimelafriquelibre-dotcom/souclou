import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const iterations = 120_000;
  const keyLength = 64;

  return new Promise<string>((resolve, reject) => {
    pbkdf2(
      password,
      salt,
      iterations,
      keyLength,
      "sha512",
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(`pbkdf2_sha512$${iterations}$${salt}$${derivedKey.toString("hex")}`);
      },
    );
  });
}

export function verifyPassword(password: string, passwordHash: string) {
  try {
    const [algorithm, iterations, salt, expectedHash] = passwordHash.split("$");

    if (algorithm !== "pbkdf2_sha512" || !iterations || !salt || !expectedHash) {
      return Promise.resolve(false);
    }

    const keyLength = 64;

    return new Promise<boolean>((resolve) => {
      pbkdf2(
        password,
        salt,
        Number(iterations),
        keyLength,
        "sha512",
        (error, derivedKey) => {
          if (error) {
            resolve(false);
            return;
          }

          const expected = Buffer.from(expectedHash, "hex");
          const actual = Buffer.from(derivedKey);

          resolve(
            expected.length === actual.length &&
              timingSafeEqual(expected, actual),
          );
        },
      );
    });
  } catch {
    return Promise.resolve(false);
  }
}