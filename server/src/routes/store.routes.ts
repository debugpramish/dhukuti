import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import StoreModel, {
  STORE_COURIER_VALUES,
  STORE_THEME_VALUES,
  type StoreShippingRules,
  type StoreTheme,
} from '../models/store.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { getStoreLogoPublicId, uploadImageBuffer } from '../services/cloudinary.service';
import { ensureMerchantStore } from '../services/merchant-data.service';
import { updateStoreSettingsSchema } from '../validation/store.validation';

const storeRouter = express.Router();
const storeLogoUploadsDirectory = path.resolve(process.cwd(), 'uploads/store-logos');
const PREMIUM_THEME_PRICE_NPR = 4999;
const PREMIUM_THEME_PAYMENT_TTL_MS = 15 * 60 * 1000;

type PremiumThemePaymentProvider = 'esewa' | 'khalti';

type PremiumThemePaymentSession = {
  id: string;
  userId: string;
  storeId: string;
  provider: PremiumThemePaymentProvider;
  amount: number;
  status: 'initiated' | 'verified';
  paymentReference?: string;
  createdAt: number;
  expiresAt: number;
};

const premiumThemePaymentSessions = new Map<string, PremiumThemePaymentSession>();

const storeLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith('image/')) {
      callback(null, true);
      return;
    }

    callback(new Error('Only image files are allowed'));
  },
});

function resolveUploadedLogoPath(logoUrl: string): string | null {
  const uploadSegment = '/uploads/store-logos/';
  const segmentIndex = logoUrl.indexOf(uploadSegment);
  if (segmentIndex < 0) {
    return null;
  }

  const rawFilename = logoUrl.slice(segmentIndex + uploadSegment.length).split(/[?#]/, 1)[0];
  if (!rawFilename) {
    return null;
  }

  const filename = path.basename(rawFilename);
  const resolvedPath = path.resolve(storeLogoUploadsDirectory, filename);

  if (!resolvedPath.startsWith(storeLogoUploadsDirectory)) {
    return null;
  }

  return resolvedPath;
}

async function removeUploadedLogoIfPresent(logoUrl: string): Promise<void> {
  const filePath = resolveUploadedLogoPath(logoUrl);
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to remove uploaded store logo:', error);
    }
  }
}

function toStoreResponse(store: {
  slug: string;
  slugChangeCount?: number;
  paidSlugChangeCredits?: number;
  name: string;
  description: string;
  phone: string;
  address: string;
  logoUrl?: string;
  activeTheme?: StoreTheme;
  premiumTheme?: {
    unlocked?: boolean;
    unlockedAt?: Date;
    paymentReference?: string;
  };
  shippingRules?: StoreShippingRules;
}) {
  const normalizedShippingRules = {
    baseFee: Number(store.shippingRules?.baseFee ?? 100),
    freeShippingAbove: Number(store.shippingRules?.freeShippingAbove ?? 1000),
    codEnabled: Boolean(store.shippingRules?.codEnabled ?? true),
    codFee: Number(store.shippingRules?.codFee ?? 50),
    defaultCourier: store.shippingRules?.defaultCourier ?? 'nepal-post',
    supportedCouriers:
      Array.isArray(store.shippingRules?.supportedCouriers) && store.shippingRules.supportedCouriers.length > 0
        ? store.shippingRules.supportedCouriers
        : [...STORE_COURIER_VALUES],
  };

  return {
    slug: store.slug,
    slugChangeCount: Math.max(0, Number(store.slugChangeCount ?? 0)),
    paidSlugChangeCredits: Math.max(0, Number(store.paidSlugChangeCredits ?? 0)),
    requiresSlugChangePayment: Math.max(0, Number(store.slugChangeCount ?? 0)) >= 1 && Math.max(0, Number(store.paidSlugChangeCredits ?? 0)) <= 0,
    name: store.name,
    description: store.description,
    phone: store.phone,
    address: store.address,
    logoUrl: store.logoUrl,
    activeTheme: STORE_THEME_VALUES.includes((store.activeTheme || 'classic') as StoreTheme)
      ? (store.activeTheme as StoreTheme)
      : 'classic',
    premiumTheme: {
      unlocked: Boolean(store.premiumTheme?.unlocked),
      unlockedAt: store.premiumTheme?.unlockedAt || undefined,
      paymentReference: store.premiumTheme?.paymentReference || undefined,
      priceNpr: PREMIUM_THEME_PRICE_NPR,
    },
    shippingRules: normalizedShippingRules,
  };
}

function normalizePremiumProvider(value: unknown): PremiumThemePaymentProvider | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'esewa' || normalized === 'khalti') {
    return normalized;
  }

  return null;
}

function cleanupExpiredPremiumThemePaymentSessions() {
  const now = Date.now();
  for (const [sessionId, session] of premiumThemePaymentSessions.entries()) {
    if (session.expiresAt <= now) {
      premiumThemePaymentSessions.delete(sessionId);
    }
  }
}

function buildPremiumThemePaymentSessionId(provider: PremiumThemePaymentProvider): string {
  return `${provider.toUpperCase()}-THM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function buildPremiumThemePaymentReference(provider: PremiumThemePaymentProvider): string {
  return `${provider.toUpperCase()}-THEME-${Date.now().toString(36).toUpperCase()}`;
}

storeRouter.get('/settings', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const store = await ensureMerchantStore(req.userId);
    if (!store) {
      return res.status(404).json({ message: 'Store settings not found' });
    }

    return res.status(200).json({
      store: toStoreResponse({
        slug: store.slug,
        slugChangeCount: store.slugChangeCount,
        paidSlugChangeCredits: store.paidSlugChangeCredits,
        name: store.name,
        description: store.description,
        phone: store.phone,
        address: store.address,
        logoUrl: store.logoUrl,
        activeTheme: store.activeTheme,
        premiumTheme: store.premiumTheme,
        shippingRules: store.shippingRules,
      }),
    });
  } catch (error) {
    console.error('Get store settings error:', error);
    return res.status(500).json({ message: 'Unable to load store settings' });
  }
});

storeRouter.put('/settings', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = updateStoreSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid store settings payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const store = await ensureMerchantStore(req.userId);

    const hasSlugInPayload = Object.prototype.hasOwnProperty.call(parsed.data, 'slug');
    const hasActiveThemeInPayload = Object.prototype.hasOwnProperty.call(parsed.data, 'activeTheme');
    const nextSlug = hasSlugInPayload && typeof parsed.data.slug === 'string'
      ? parsed.data.slug.trim().toLowerCase()
      : store.slug;
    const nextActiveTheme = hasActiveThemeInPayload
      ? parsed.data.activeTheme || 'classic'
      : store.activeTheme || 'classic';
    const isSlugChangeRequested = hasSlugInPayload && nextSlug !== store.slug;
    const isPremiumThemeActivationRequested = hasActiveThemeInPayload
      && nextActiveTheme === 'maison_premium'
      && (store.activeTheme || 'classic') !== 'maison_premium';
    const isPremiumThemeUnlocked = Boolean(store.premiumTheme?.unlocked);
    const slugChangeCount = Math.max(0, Number(store.slugChangeCount ?? 0));
    const paidSlugChangeCredits = Math.max(0, Number(store.paidSlugChangeCredits ?? 0));
    const hasFreeSlugChangeRemaining = slugChangeCount < 1;
    const canUsePaidSlugChangeCredit = paidSlugChangeCredits > 0;
    const canChangeSlug = hasFreeSlugChangeRemaining || canUsePaidSlugChangeCredit;

    if (isSlugChangeRequested && !canChangeSlug) {
      return res.status(402).json({
        message: 'You have already used your free storefront URL change. Additional URL changes require payment.',
      });
    }

    if (isPremiumThemeActivationRequested && !isPremiumThemeUnlocked) {
      return res.status(402).json({
        message: 'Premium theme activation requires payment. Complete the premium checkout first.',
      });
    }

    console.log('[store-settings:update] request', {
      userId: req.userId,
      incomingSlug: hasSlugInPayload ? parsed.data.slug : undefined,
      previousSlug: store.slug,
      nextSlug,
    });

    const updateDocument: {
      $set: Record<string, unknown>;
      $inc?: Record<string, number>;
    } = {
      $set: {
        ...(hasSlugInPayload ? { slug: nextSlug } : {}),
        ...(hasActiveThemeInPayload ? { activeTheme: nextActiveTheme } : {}),
        name: parsed.data.name,
        description: parsed.data.description,
        phone: parsed.data.phone,
        address: parsed.data.address,
      },
    };

    if (isSlugChangeRequested) {
      updateDocument.$inc = {
        slugChangeCount: 1,
        ...(hasFreeSlugChangeRemaining ? {} : { paidSlugChangeCredits: -1 }),
      };
    }

    const updatedStore = await StoreModel.findByIdAndUpdate(store._id, updateDocument, {
      new: true,
      runValidators: true,
    });

    if (!updatedStore) {
      return res.status(404).json({ message: 'Store settings not found' });
    }

    console.log('[store-settings:update] persisted', {
      userId: req.userId,
      persistedSlug: updatedStore.slug,
    });

    return res.status(200).json({
      store: toStoreResponse({
        slug: updatedStore.slug,
        slugChangeCount: updatedStore.slugChangeCount,
        paidSlugChangeCredits: updatedStore.paidSlugChangeCredits,
        name: updatedStore.name,
        description: updatedStore.description,
        phone: updatedStore.phone,
        address: updatedStore.address,
        logoUrl: updatedStore.logoUrl,
        activeTheme: updatedStore.activeTheme,
        premiumTheme: updatedStore.premiumTheme,
        shippingRules: updatedStore.shippingRules,
      }),
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      return res.status(409).json({ message: 'Storefront name is unavailable. Please choose another one.' });
    }

    console.error('Update store settings error:', error);
    return res.status(500).json({ message: 'Unable to update store settings' });
  }
});

storeRouter.put('/settings/logo', requireAuth, requireMerchant, (req, res) => {
  storeLogoUpload.single('logo')(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    try {
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Logo file is required' });
      }

      const store = await ensureMerchantStore(req.userId);
      const previousLogoUrl = store.logoUrl || '';

      if (!req.file.buffer) {
        return res.status(400).json({ message: 'Invalid logo upload' });
      }

      try {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          publicId: getStoreLogoPublicId(store._id.toString()),
        });
        store.logoUrl = uploadResult.secureUrl;
      } catch (error) {
        console.error('Upload store logo error:', error);
        return res.status(500).json({ message: 'Unable to upload store logo' });
      }

      await store.save();

      if (previousLogoUrl && previousLogoUrl !== store.logoUrl) {
        await removeUploadedLogoIfPresent(previousLogoUrl);
      }

      return res.status(200).json({
        store: toStoreResponse({
          slug: store.slug,
          slugChangeCount: store.slugChangeCount,
          paidSlugChangeCredits: store.paidSlugChangeCredits,
          name: store.name,
          description: store.description,
          phone: store.phone,
          address: store.address,
          logoUrl: store.logoUrl,
          activeTheme: store.activeTheme,
          premiumTheme: store.premiumTheme,
          shippingRules: store.shippingRules,
        }),
      });
    } catch (error) {
      console.error('Upload store logo error:', error);
      return res.status(500).json({ message: 'Unable to upload store logo' });
    }
  });
});

storeRouter.post('/themes/maison-premium/initiate', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const provider = normalizePremiumProvider(req.body?.provider);
    if (!provider) {
      return res.status(400).json({ message: 'Unsupported payment provider. Use eSewa or Khalti.' });
    }

    const store = await ensureMerchantStore(req.userId);

    if (store.premiumTheme?.unlocked) {
      return res.status(409).json({ message: 'Premium theme is already unlocked for this store.' });
    }

    cleanupExpiredPremiumThemePaymentSessions();

    const now = Date.now();
    const paymentSession: PremiumThemePaymentSession = {
      id: buildPremiumThemePaymentSessionId(provider),
      userId: req.userId,
      storeId: store._id.toString(),
      provider,
      amount: PREMIUM_THEME_PRICE_NPR,
      status: 'initiated',
      createdAt: now,
      expiresAt: now + PREMIUM_THEME_PAYMENT_TTL_MS,
    };

    premiumThemePaymentSessions.set(paymentSession.id, paymentSession);

    return res.status(200).json({
      payment: {
        provider,
        paymentSessionId: paymentSession.id,
        status: paymentSession.status,
        amount: paymentSession.amount,
        expiresAt: new Date(paymentSession.expiresAt).toISOString(),
      },
    });
  } catch (error) {
    console.error('Initiate premium theme payment error:', error);
    return res.status(500).json({ message: 'Unable to initiate premium theme payment' });
  }
});

storeRouter.post('/themes/maison-premium/verify-and-activate', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const paymentSessionId = String(req.body?.paymentSessionId || '').trim();
    if (!paymentSessionId) {
      return res.status(400).json({ message: 'paymentSessionId is required' });
    }

    cleanupExpiredPremiumThemePaymentSessions();
    const session = premiumThemePaymentSessions.get(paymentSessionId);

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ message: 'Payment session not found or expired' });
    }

    if (session.expiresAt <= Date.now()) {
      premiumThemePaymentSessions.delete(paymentSessionId);
      return res.status(410).json({ message: 'Payment session expired. Please initiate again.' });
    }

    const store = await ensureMerchantStore(req.userId);
    if (store._id.toString() !== session.storeId) {
      return res.status(409).json({ message: 'Payment session does not match the active store' });
    }

    const paymentReference = buildPremiumThemePaymentReference(session.provider);
    session.status = 'verified';
    session.paymentReference = paymentReference;
    premiumThemePaymentSessions.set(paymentSessionId, session);

    store.premiumTheme = {
      unlocked: true,
      unlockedAt: new Date(),
      paymentReference,
    };
    store.activeTheme = 'maison_premium';
    await store.save();

    return res.status(200).json({
      payment: {
        provider: session.provider,
        paymentSessionId: session.id,
        status: session.status,
        amount: session.amount,
        paymentReference,
      },
      store: toStoreResponse({
        slug: store.slug,
        slugChangeCount: store.slugChangeCount,
        paidSlugChangeCredits: store.paidSlugChangeCredits,
        name: store.name,
        description: store.description,
        phone: store.phone,
        address: store.address,
        logoUrl: store.logoUrl,
        activeTheme: store.activeTheme,
        premiumTheme: store.premiumTheme,
        shippingRules: store.shippingRules,
      }),
    });
  } catch (error) {
    console.error('Verify premium theme payment error:', error);
    return res.status(500).json({ message: 'Unable to verify premium theme payment' });
  }
});

export default storeRouter;
