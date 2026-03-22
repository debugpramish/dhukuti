import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import StoreModel, { STORE_COURIER_VALUES, type StoreShippingRules } from '../models/store.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { getStoreLogoPublicId, uploadImageBuffer } from '../services/cloudinary.service';
import { ensureMerchantStore } from '../services/merchant-data.service';
import { updateStoreSettingsSchema } from '../validation/store.validation';

const storeRouter = express.Router();
const storeLogoUploadsDirectory = path.resolve(process.cwd(), 'uploads/store-logos');

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
    shippingRules: normalizedShippingRules,
  };
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
        name: store.name,
        description: store.description,
        phone: store.phone,
        address: store.address,
        logoUrl: store.logoUrl,
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
    const nextSlug = hasSlugInPayload && typeof parsed.data.slug === 'string'
      ? parsed.data.slug.trim().toLowerCase()
      : store.slug;
    const isSlugChangeRequested = hasSlugInPayload && nextSlug !== store.slug;
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
        name: updatedStore.name,
        description: updatedStore.description,
        phone: updatedStore.phone,
        address: updatedStore.address,
        logoUrl: updatedStore.logoUrl,
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
          name: store.name,
          description: store.description,
          phone: store.phone,
          address: store.address,
          logoUrl: store.logoUrl,
          shippingRules: store.shippingRules,
        }),
      });
    } catch (error) {
      console.error('Upload store logo error:', error);
      return res.status(500).json({ message: 'Unable to upload store logo' });
    }
  });
});

export default storeRouter;
