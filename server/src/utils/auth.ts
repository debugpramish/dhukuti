import jwt, { type SignOptions } from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return secret;
}

export function signAuthToken(userId: string) {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  return jwt.sign({}, getJwtSecret(), {
    subject: userId,
    expiresIn,
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, getJwtSecret());
}
