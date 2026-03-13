import { type NextFunction, type Request, type Response } from 'express';
import StoreModel from '../models/store.model';

declare global {
  namespace Express {
    // Store context resolved from :slug param or inferred from JWT.
    interface Request {
      storeId?: string;
      storeSlug?: string;
      store?: {
        _id: string;
        slug: string;
        ownerId: string;
        shippingRules?: unknown;
      } | null;
    }
  }
}

export async function resolveStore(req: Request, res: Response, next: NextFunction) {
  const rawSlug = typeof req.params.slug === 'string' ? req.params.slug.trim().toLowerCase() : '';

  if (!rawSlug) {
    return res.status(400).json({ message: 'Store slug is required in the path' });
  }

  try {
    const store = await StoreModel.findOne({ slug: rawSlug }).lean();
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    req.storeId = store._id.toString();
    req.storeSlug = store.slug;
    req.store = {
      _id: store._id.toString(),
      slug: store.slug,
      ownerId: store.ownerId.toString(),
      shippingRules: store.shippingRules,
    };

    return next();
  } catch (error) {
    console.error('resolveStore middleware error:', error);
    return res.status(500).json({ message: 'Unable to resolve store context' });
  }
}
