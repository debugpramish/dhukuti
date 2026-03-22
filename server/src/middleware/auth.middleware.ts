import { type NextFunction, type Request, type Response } from 'express';
import UserModel from '../models/user.model';
import CustomerModel from '../models/customer.model';
import { verifyAuthToken, type AuthPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      userId?: string; // kept for backward compatibility
      authUserId?: string;
      authRole?: 'merchant' | 'customer';
      merchantId?: string;
      customerId?: string;
      storeId?: string;
    }
  }
}

function attachAuthContext(req: Request, payload: AuthPayload) {
  req.authUserId = payload.sub;
  req.userId = payload.sub;
  req.authRole = payload.role;

  if (payload.role === 'merchant') {
    req.merchantId = payload.sub;
  } else {
    req.customerId = payload.sub;
    req.storeId = payload.storeId ?? req.storeId;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  try {
    const payload = verifyAuthToken(token);
    attachAuthContext(req, payload);
    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown auth error');

    // Invalid/expired JWTs are expected when switching environments or after logout.
    // Keep logs concise instead of printing full stack traces on every request.
    if (/invalid signature|jwt malformed|jwt expired|invalid token/i.test(message)) {
      console.warn(`Auth verification rejected token: ${message}`);
    } else {
      console.error('Auth verification error:', error);
    }

    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }
}

export async function requireMerchant(req: Request, res: Response, next: NextFunction) {
  if (req.authRole !== 'merchant' || !req.merchantId) {
    return res.status(403).json({ message: 'Please login with a merchant account' });
  }

  try {
    const merchant = await UserModel.findById(req.merchantId).select({ _id: 1 });
    if (!merchant) {
      return res.status(401).json({ message: 'Merchant account not found' });
    }

    return next();
  } catch (error) {
    console.error('Merchant guard error:', error);
    return res.status(500).json({ message: 'Unable to validate merchant account' });
  }
}

export async function requireCustomer(req: Request, res: Response, next: NextFunction) {
  if (req.authRole !== 'customer' || !req.customerId) {
    return res.status(403).json({ message: 'Please login with a customer account' });
  }

  try {
    const customer = await CustomerModel.findById(req.customerId).select({ storeId: 1 });
    if (!customer) {
      return res.status(401).json({ message: 'Customer account not found' });
    }

    const customerStoreId = customer.storeId.toString();
    if (req.storeId && req.storeId !== customerStoreId) {
      return res.status(403).json({ message: 'Customer token is not valid for this store' });
    }

    // Ensure downstream handlers always have storeId.
    req.storeId = req.storeId ?? customerStoreId;

    return next();
  } catch (error) {
    console.error('Customer guard error:', error);
    return res.status(500).json({ message: 'Unable to validate customer account' });
  }
}
