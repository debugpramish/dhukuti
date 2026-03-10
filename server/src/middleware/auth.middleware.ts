import { type NextFunction, type Request, type Response } from 'express';
import UserModel, { type UserRole } from '../models/user.model';
import { verifyAuthToken } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
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

    if (typeof payload === 'string' || !payload.sub) {
      return res.status(401).json({ message: 'Invalid authorization token' });
    }

    req.userId = payload.sub;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }
}

function resolveUserRole(role: unknown): UserRole {
  return role === 'customer' ? 'customer' : 'merchant';
}

function buildRoleGuard(requiredRole: UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const user = await UserModel.findById(req.userId).select({ role: 1 });
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (resolveUserRole(user.role) !== requiredRole) {
        return res.status(403).json({
          message:
            requiredRole === 'merchant'
              ? 'Please login with a merchant account'
              : 'Please login with a customer account',
        });
      }

      return next();
    } catch (error) {
      console.error('Role guard error:', error);
      return res.status(500).json({ message: 'Unable to validate account role' });
    }
  };
}

export const requireMerchant = buildRoleGuard('merchant');
export const requireCustomer = buildRoleGuard('customer');
