import { type Request, type Response } from 'express';
import { z } from 'zod';
import CustomerModel, { type CustomerDocument } from '../models/customer.model';
import { hashPassword, verifyPassword } from '../utils/password';
import { signCustomerToken } from '../utils/jwt';
import { customerProfileUpdateSchema, loginSchema, signupSchema } from '../validation/auth.validation';
import StoreModel from '../models/store.model';
import { deleteCustomerFromStoreFolder, upsertCustomerInStoreFolder } from '../services/customer-folder.service';

function toPublicCustomer(customer: CustomerDocument) {
  return {
    id: customer._id.toString(),
    storeId: customer.storeId.toString(),
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

const customerListQuerySchema = z.object({
  page: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 1;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    },
    z.number().int('Page must be an integer').min(1, 'Page must be at least 1').default(1),
  ),
  limit: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 20;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    },
    z.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(100, 'Limit is too large').default(20),
  ),
  search: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z.string().max(120, 'Search is too long').default(''),
  ),
});

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'number' &&
    (error as { code: number }).code === 11000
  );
}

async function ensureStoreContext(req: Request) {
  if (req.storeId) {
    return req.storeId;
  }

  // Fallback: resolve store by slug in params if middleware wasn't applied.
  const slug = typeof req.params.slug === 'string' ? req.params.slug.trim().toLowerCase() : '';
  if (!slug) {
    return null;
  }

  const store = await StoreModel.findOne({ slug }).select({ _id: 1 });
  return store?._id.toString() ?? null;
}

async function resolveStoreSlug(req: Request, storeId: string): Promise<string | null> {
  if (req.storeSlug) {
    return req.storeSlug;
  }

  const store = await StoreModel.findById(storeId).select({ slug: 1 });
  return store?.slug ?? null;
}

export async function registerCustomer(req: Request, res: Response) {
  const storeId = await ensureStoreContext(req);
  if (!storeId) {
    return res.status(400).json({ message: 'Store context is required to register a customer' });
  }

  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid signup data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await CustomerModel.findOne({ storeId, email });
  if (existing) {
    return res.status(409).json({ message: 'An account already exists with this email for this store' });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  let customer: CustomerDocument;

  try {
    customer = await CustomerModel.create({
      storeId,
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      passwordHash,
    });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return res.status(409).json({ message: 'An account already exists with this email for this store' });
    }

    throw error;
  }

  const token = signCustomerToken(customer._id.toString(), storeId);

  try {
    const storeSlug = await resolveStoreSlug(req, storeId);
    if (storeSlug) {
      await upsertCustomerInStoreFolder({
        storeSlug,
        customer,
      });
    }
  } catch (error) {
    // Keep registration successful even if filesystem mirroring fails.
    console.error('Customer folder mirror write error:', error);
  }

  return res.status(201).json({
    message: 'Customer account created successfully',
    token,
    customer: toPublicCustomer(customer),
  });
}

export async function updateCurrentCustomer(req: Request, res: Response) {
  const customerId = req.customerId ?? req.authUserId;
  if (!customerId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const parsed = customerProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid customer update data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const customer = await CustomerModel.findById(customerId);
  if (!customer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const storeId = customer.storeId.toString();
  if (req.storeId && req.storeId !== storeId) {
    return res.status(403).json({ message: 'Customer token is not valid for this store' });
  }

  const nextEmail = parsed.data.email?.toLowerCase();
  if (nextEmail && nextEmail !== customer.email) {
    const existing = await CustomerModel.findOne({
      _id: { $ne: customer._id },
      storeId,
      email: nextEmail,
    }).select({ _id: 1 });

    if (existing) {
      return res.status(409).json({ message: 'An account already exists with this email for this store' });
    }

    customer.email = nextEmail;
  }

  if (typeof parsed.data.name === 'string') {
    customer.name = parsed.data.name;
  }

  if (typeof parsed.data.phone === 'string') {
    customer.phone = parsed.data.phone;
  }

  if (typeof parsed.data.address === 'string') {
    customer.address = parsed.data.address;
  }

  try {
    await customer.save();
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return res.status(409).json({ message: 'An account already exists with this email for this store' });
    }

    throw error;
  }

  try {
    const storeSlug = await resolveStoreSlug(req, storeId);
    if (storeSlug) {
      await upsertCustomerInStoreFolder({
        storeSlug,
        customer,
      });
    }
  } catch (error) {
    console.error('Customer folder mirror update error:', error);
  }

  req.storeId = req.storeId ?? storeId;
  return res.status(200).json({
    message: 'Customer profile updated successfully',
    customer: toPublicCustomer(customer),
  });
}

export async function deleteCurrentCustomer(req: Request, res: Response) {
  const customerId = req.customerId ?? req.authUserId;
  if (!customerId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const customer = await CustomerModel.findById(customerId).select({ _id: 1, storeId: 1 });
  if (!customer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const storeId = customer.storeId.toString();
  if (req.storeId && req.storeId !== storeId) {
    return res.status(403).json({ message: 'Customer token is not valid for this store' });
  }

  await CustomerModel.deleteOne({ _id: customer._id });

  try {
    const storeSlug = await resolveStoreSlug(req, storeId);
    if (storeSlug) {
      await deleteCustomerFromStoreFolder({
        storeSlug,
        customerId: customer._id.toString(),
      });
    }
  } catch (error) {
    console.error('Customer folder mirror delete error:', error);
  }

  return res.status(200).json({
    message: 'Customer account deleted successfully',
  });
}

export async function loginCustomer(req: Request, res: Response) {
  const storeId = await ensureStoreContext(req);
  if (!storeId) {
    return res.status(400).json({ message: 'Store context is required to login' });
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid login data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();
  const customer = await CustomerModel.findOne({ storeId, email });
  if (!customer) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const passwordMatches = await verifyPassword(parsed.data.password, customer.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = signCustomerToken(customer._id.toString(), storeId);
  return res.status(200).json({
    message: 'Login successful',
    token,
    customer: toPublicCustomer(customer),
  });
}

export async function currentCustomer(req: Request, res: Response) {
  const customerId = req.customerId ?? req.authUserId;
  if (!customerId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const customer = await CustomerModel.findById(customerId);
  if (!customer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Enforce store scope in response as well.
  const storeId = customer.storeId.toString();
  if (req.storeId && req.storeId !== storeId) {
    return res.status(403).json({ message: 'Customer token is not valid for this store' });
  }

  req.storeId = req.storeId ?? storeId;
  return res.status(200).json({ customer: toPublicCustomer(customer) });
}

export async function listStoreCustomers(req: Request, res: Response) {
  try {
    const storeId = await ensureStoreContext(req);
    if (!storeId) {
      return res.status(400).json({ message: 'Store context is required to list customers' });
    }

    if (!req.merchantId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.store?.ownerId && req.store.ownerId !== req.merchantId) {
      return res.status(403).json({ message: 'You do not have access to this store customers list' });
    }

    const parsedQuery = customerListQuerySchema.safeParse({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: 'Invalid customer query parameters',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const { page, limit, search } = parsedQuery.data;
    const skip = (page - 1) * limit;

    const normalizedSearch = search.trim();
    const filter: Record<string, unknown> = { storeId };

    if (normalizedSearch) {
      const regex = new RegExp(escapeRegexLiteral(normalizedSearch), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    const [total, customers] = await Promise.all([
      CustomerModel.countDocuments(filter),
      CustomerModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      customers: customers.map(toPublicCustomer),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    console.error('List store customers error:', error);
    return res.status(500).json({ message: 'Unable to load customers' });
  }
}
