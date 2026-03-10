import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import StoreModel, { STORE_COURIER_VALUES, type StoreShippingRules } from '../models/store.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData, ensureMerchantStore } from '../services/merchant-data.service';
import { updateStoreSettingsSchema } from '../validation/store.validation';

const storeRouter = express.Router();
const storeLogoUploadsDirectory = path.resolve(process.cwd(), 'uploads/store-logos');
fs.mkdirSync(storeLogoUploadsDirectory, { recursive: true });

const storeLogoStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, storeLogoUploadsDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.jpg';
    const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
    const generatedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`;
    callback(null, generatedName);
  },
});

const storeLogoUpload = multer({
  storage: storeLogoStorage,
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

function toPublicLogoUrl(_req: express.Request, filename: string): string {
  return `/uploads/store-logos/${filename}`;
}

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

    await ensureMerchantDemoData(req.userId);

    const store = await StoreModel.findOne({ ownerId: req.userId });
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

    store.name = parsed.data.name;
    store.description = parsed.data.description;
    store.phone = parsed.data.phone;
    store.address = parsed.data.address;
    await store.save();

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

      store.logoUrl = toPublicLogoUrl(req, req.file.filename);
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
