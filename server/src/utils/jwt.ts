import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
const DEFAULT_ISSUER = 'dhukuti-api';
const DEFAULT_AUDIENCE = 'dhukuti-clients';

export type MerchantAuthPayload = JwtPayload & {
  sub: string;
  role: 'merchant';
};

export type CustomerAuthPayload = JwtPayload & {
  sub: string;
  role: 'customer';
  storeId: string;
};

export type AuthPayload = MerchantAuthPayload | CustomerAuthPayload;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  return secret;
}

export function signMerchantToken(merchantId: string, options: SignOptions = {}): string {
  return jwt.sign(
    { role: 'merchant' },
    getJwtSecret(),
    {
      subject: merchantId,
      expiresIn: DEFAULT_EXPIRES_IN,
      issuer: DEFAULT_ISSUER,
      audience: DEFAULT_AUDIENCE,
      ...options,
    },
  );
}

export function signCustomerToken(customerId: string, storeId: string, options: SignOptions = {}): string {
  return jwt.sign(
    { role: 'customer', storeId },
    getJwtSecret(),
    {
      subject: customerId,
      expiresIn: DEFAULT_EXPIRES_IN,
      issuer: DEFAULT_ISSUER,
      audience: DEFAULT_AUDIENCE,
      ...options,
    },
  );
}

export function verifyAuthToken(token: string): AuthPayload {
  const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;

  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Invalid JWT subject');
  }

  if (payload.role === 'customer' && typeof payload.storeId !== 'string') {
    throw new Error('Customer token missing store context');
  }

  return payload;
}
