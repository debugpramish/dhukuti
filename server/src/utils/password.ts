import bcrypt from 'bcryptjs';

const DEFAULT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, DEFAULT_SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
