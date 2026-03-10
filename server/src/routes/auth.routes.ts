import express from 'express';
import bcrypt from 'bcryptjs';
import UserModel, { type UserDocument, type UserRole } from '../models/user.model';
import { loginSchema, signupSchema } from '../validation/auth.validation';
import { signAuthToken } from '../utils/auth';
import { requireAuth } from '../middleware/auth.middleware';

const authRouter = express.Router();

function resolveUserRole(user: Pick<UserDocument, 'role'>): UserRole {
  return user.role === 'customer' ? 'customer' : 'merchant';
}

function publicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    role: resolveUserRole(user),
    createdAt: user.createdAt,
  };
}

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid signup data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();

  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: 'An account already exists with this email' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await UserModel.create({
    name: parsed.data.name,
    email,
    phone: parsed.data.phone,
    address: parsed.data.address,
    passwordHash,
    role: 'merchant',
  });

  const token = signAuthToken(user._id.toString());

  return res.status(201).json({
    message: 'Account created successfully',
    token,
    user: publicUser(user),
  });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid login data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await UserModel.findOne({ email });

  if (!user || resolveUserRole(user) !== 'merchant') {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = signAuthToken(user._id.toString());

  return res.status(200).json({
    message: 'Login successful',
    token,
    user: publicUser(user),
  });
});

authRouter.post('/customer/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid signup data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();

  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: 'An account already exists with this email' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await UserModel.create({
    name: parsed.data.name,
    email,
    phone: parsed.data.phone,
    address: parsed.data.address,
    passwordHash,
    role: 'customer',
  });

  const token = signAuthToken(user._id.toString());

  return res.status(201).json({
    message: 'Customer account created successfully',
    token,
    user: publicUser(user),
  });
});

authRouter.post('/customer/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid login data',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await UserModel.findOne({ email });

  if (!user || resolveUserRole(user) !== 'customer') {
    return res.status(401).json({ message: 'Invalid customer email or password' });
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid customer email or password' });
  }

  const token = signAuthToken(user._id.toString());

  return res.status(200).json({
    message: 'Customer login successful',
    token,
    user: publicUser(user),
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await UserModel.findById(req.userId);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return res.status(200).json({ user: publicUser(user) });
});

export default authRouter;
