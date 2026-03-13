import { type Request, type Response } from 'express';
import CustomerModel, { type CustomerDocument } from '../models/customer.model';
import { hashPassword, verifyPassword } from '../utils/password';
import { signCustomerToken } from '../utils/jwt';
import { loginSchema, signupSchema } from '../validation/auth.validation';
import StoreModel from '../models/store.model';

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
  const customer = await CustomerModel.create({
    storeId,
    name: parsed.data.name,
    email,
    phone: parsed.data.phone,
    address: parsed.data.address,
    passwordHash,
  });

  const token = signCustomerToken(customer._id.toString(), storeId);
  return res.status(201).json({
    message: 'Customer account created successfully',
    token,
    customer: toPublicCustomer(customer),
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
