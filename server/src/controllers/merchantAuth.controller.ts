import { type Request, type Response } from 'express';
import UserModel, { type UserDocument } from '../models/user.model';
import { hashPassword, verifyPassword } from '../utils/password';
import { signMerchantToken } from '../utils/jwt';
import { loginSchema, signupSchema } from '../validation/auth.validation';

function toPublicMerchant(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    role: 'merchant' as const,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerMerchant(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid signup data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await UserModel.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: 'An account already exists with this email' });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await UserModel.create({
    name: parsed.data.name,
    email,
    phone: parsed.data.phone,
    address: parsed.data.address,
    passwordHash,
    role: 'merchant',
  });

  const token = signMerchantToken(user._id.toString());
  return res.status(201).json({
    message: 'Merchant account created successfully',
    token,
    user: toPublicMerchant(user),
  });
}

export async function loginMerchant(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid login data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await UserModel.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = signMerchantToken(user._id.toString());
  return res.status(200).json({
    message: 'Login successful',
    token,
    user: toPublicMerchant(user),
  });
}

export async function currentMerchant(req: Request, res: Response) {
  const merchantId = req.merchantId ?? req.authUserId;
  if (!merchantId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await UserModel.findById(merchantId);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return res.status(200).json({ user: toPublicMerchant(user) });
}
