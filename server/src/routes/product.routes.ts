import express from 'express';
import fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import path from 'path';
import ProductModel, { type ProductDiscountType, type ProductPaymentPolicy } from '../models/product.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData } from '../services/merchant-data.service';
import { destroyImageByPublicId, getProductImagePublicId, uploadImageBuffer } from '../services/cloudinary.service';
import {
  createProductSchema,
  updateProductBestSellerSchema,
  updateProductFlagsSchema,
  updateProductFeaturedSchema,
  updateProductTrendingSchema,
  updateProductSchema,
} from '../validation/product.validation';

const productRouter = express.Router();

const uploadsDirectory = path.resolve(process.cwd(), 'uploads/products');

const upload = multer({
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

function toProductResponse(product: {
  _id: mongoose.Types.ObjectId;
  title: string;
  category?: string;
  price: number;
  discountType: string;
  discountValue: number;
  imageUrl: string;
  status: string;
  paymentPolicy?: string;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  variants: Array<{
    _id: mongoose.Types.ObjectId;
    sku: string;
    name: string;
    stock: number;
    lowStockThreshold: number;
    isDefault: boolean;
  }>;
}) {
  const discountType = normalizeDiscountType(product.discountType);
  const paymentPolicy = normalizePaymentPolicy(product.paymentPolicy);
  const discountValue = Number(product.discountValue ?? 0);
  const discountedPrice = calculateDiscountedPrice(product.price, discountType, discountValue);
  const discountAmount = roundCurrency(Math.max(product.price - discountedPrice, 0));

  return {
    id: product._id.toString(),
    title: product.title,
    category: product.category?.trim() || 'Uncategorized',
    price: product.price,
    discountType,
    discountValue,
    discountedPrice,
    discountAmount,
    hasDiscount: discountAmount > 0,
    imageUrl: product.imageUrl,
    status: product.status,
    paymentPolicy,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    isBestSeller: product.isBestSeller,
    variants: product.variants.map((variant) => ({
      id: variant._id.toString(),
      sku: variant.sku,
      name: variant.name,
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      isDefault: variant.isDefault,
    })),
  };
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDiscountType(value: string): ProductDiscountType {
  if (value === 'percentage' || value === 'fixed') {
    return value;
  }

  return 'none';
}

function normalizePaymentPolicy(value: string | undefined): ProductPaymentPolicy {
  if (value === 'PREPAID_ONLY') {
    return 'PREPAID_ONLY';
  }

  return 'POSTPAID';
}

function calculateDiscountedPrice(price: number, discountType: string, discountValue: number): number {
  const normalizedPrice = roundCurrency(Math.max(price, 0));
  const normalizedDiscountValue = roundCurrency(Math.max(discountValue, 0));

  if (discountType === 'percentage') {
    const percentage = Math.min(normalizedDiscountValue, 95);
    return roundCurrency(Math.max(0, normalizedPrice - (normalizedPrice * percentage) / 100));
  }

  if (discountType === 'fixed') {
    return roundCurrency(Math.max(0, normalizedPrice - normalizedDiscountValue));
  }

  return normalizedPrice;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildPlaceholderImage(title: string): string {
  const safeTitle = escapeSvgText(title.trim().slice(0, 32) || 'Product');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#334155" font-size="24" font-family="Arial, sans-serif">${safeTitle}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function resolveUploadedFilePath(imageUrl: string): string | null {
  const uploadSegment = '/uploads/products/';
  const segmentIndex = imageUrl.indexOf(uploadSegment);
  if (segmentIndex < 0) {
    return null;
  }

  const rawFilename = imageUrl.slice(segmentIndex + uploadSegment.length).split(/[?#]/, 1)[0];
  if (!rawFilename) {
    return null;
  }

  const filename = path.basename(rawFilename);
  const resolvedPath = path.resolve(uploadsDirectory, filename);

  if (!resolvedPath.startsWith(uploadsDirectory)) {
    return null;
  }

  return resolvedPath;
}

async function removeUploadedImageIfPresent(imageUrl: string): Promise<void> {
  const filePath = resolveUploadedFilePath(imageUrl);
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    // Ignore missing files; deletion should not fail if file already removed.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to remove uploaded image:', error);
    }
  }
}

function buildDefaultVariant(options?: { stock?: number; lowStockThreshold?: number }): {
  _id: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  isDefault: boolean;
} {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return {
    _id: new mongoose.Types.ObjectId(),
    sku: `SKU-${Date.now().toString(36).toUpperCase()}-${suffix}`,
    name: 'Default',
    stock: options?.stock ?? 0,
    lowStockThreshold: options?.lowStockThreshold ?? 5,
    isDefault: true,
  };
}

async function ensureDefaultVariant(product: {
  _id: mongoose.Types.ObjectId;
  variants: Array<{
    _id: mongoose.Types.ObjectId;
    sku: string;
    name: string;
    stock: number;
    lowStockThreshold: number;
    isDefault: boolean;
  }>;
  save: () => Promise<unknown>;
}) {
  if (product.variants.length > 0) {
    return;
  }

  product.variants = [buildDefaultVariant()];
  await product.save();
}

productRouter.get('/', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const products = await ProductModel.find({ ownerId: req.userId }).sort({ createdAt: -1 });

    for (const product of products) {
      if (product.variants.length === 0) {
        await ensureDefaultVariant(product);
      }
    }

    return res.status(200).json({
      products: products.map((product) =>
        toProductResponse({
          _id: product._id,
          title: product.title,
          category: product.category,
          price: product.price,
          discountType: product.discountType,
          discountValue: product.discountValue,
          imageUrl: product.imageUrl,
          status: product.status,
          paymentPolicy: product.paymentPolicy,
          isFeatured: product.isFeatured,
          isTrending: product.isTrending,
          isBestSeller: product.isBestSeller,
          variants: product.variants,
        }),
      ),
    });
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({ message: 'Unable to load products' });
  }
});

productRouter.post('/', requireAuth, requireMerchant, (req, res) => {
  upload.single('image')(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    try {
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      await ensureMerchantDemoData(req.userId);

      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid product create payload',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const productId = new mongoose.Types.ObjectId();
      const productIdString = productId.toString();

      let imageUrl = buildPlaceholderImage(parsed.data.title);
      let uploadedPublicId: string | null = null;

      if (req.file) {
        if (!req.file.buffer) {
          return res.status(400).json({ message: 'Invalid image upload' });
        }

        try {
          uploadedPublicId = getProductImagePublicId(productIdString);
          const uploadResult = await uploadImageBuffer({
            buffer: req.file.buffer,
            publicId: uploadedPublicId,
          });
          imageUrl = uploadResult.secureUrl;
        } catch (error) {
          console.error('Upload product image error:', error);
          return res.status(500).json({ message: 'Unable to upload product image' });
        }
      }

      try {
        const created = await ProductModel.create({
          _id: productId,
          ownerId: req.userId,
          title: parsed.data.title,
          category: parsed.data.category,
          price: parsed.data.price,
          discountType: parsed.data.discountType,
          discountValue: parsed.data.discountValue,
          status: parsed.data.status,
          paymentPolicy: parsed.data.paymentPolicy,
          isFeatured: parsed.data.isFeatured,
          isTrending: parsed.data.isTrending,
          isBestSeller: parsed.data.isBestSeller,
          imageUrl,
          variants: [
            buildDefaultVariant({
              stock: parsed.data.stock,
              lowStockThreshold: parsed.data.lowStockThreshold,
            }),
          ],
        });

        const product = Array.isArray(created) ? created[0] : created;

        return res.status(201).json({
          product: toProductResponse({
            _id: product._id,
            title: product.title,
            category: product.category,
            price: product.price,
            discountType: product.discountType,
            discountValue: product.discountValue,
            imageUrl: product.imageUrl,
            status: product.status,
            paymentPolicy: product.paymentPolicy,
            isFeatured: product.isFeatured,
            isTrending: product.isTrending,
            isBestSeller: product.isBestSeller,
            variants: product.variants,
          }),
        });
      } catch (error) {
        if (uploadedPublicId) {
          await destroyImageByPublicId(uploadedPublicId);
        }

        throw error;
      }
    } catch (error) {
      console.error('Create product error:', error);
      return res.status(500).json({ message: 'Unable to create product' });
    }
  });
});

productRouter.put('/:productId', requireAuth, requireMerchant, (req, res) => {
  upload.single('image')(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    try {
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const rawProductId = req.params.productId;
      if (typeof rawProductId !== 'string') {
        return res.status(400).json({ message: 'Invalid product id' });
      }

      const productId = rawProductId;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid product id' });
      }

      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid product update payload',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const product = await ProductModel.findOne({ _id: productId, ownerId: req.userId });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const previousImageUrl = product.imageUrl;
      product.price = parsed.data.price;
      product.discountType = parsed.data.discountType;
      product.discountValue = parsed.data.discountValue;
      if (parsed.data.paymentPolicy) {
        product.paymentPolicy = parsed.data.paymentPolicy;
      }

      if (req.file) {
        if (!req.file.buffer) {
          return res.status(400).json({ message: 'Invalid image upload' });
        }

        try {
          const uploadResult = await uploadImageBuffer({
            buffer: req.file.buffer,
            publicId: getProductImagePublicId(product._id.toString()),
          });

          product.imageUrl = uploadResult.secureUrl;
        } catch (error) {
          console.error('Upload product image error:', error);
          return res.status(500).json({ message: 'Unable to upload product image' });
        }
      }

      await product.save();
      if (req.file && previousImageUrl !== product.imageUrl) {
        await removeUploadedImageIfPresent(previousImageUrl);
      }

      return res.status(200).json({
        product: toProductResponse({
          _id: product._id,
          title: product.title,
          category: product.category,
          price: product.price,
          discountType: product.discountType,
          discountValue: product.discountValue,
          imageUrl: product.imageUrl,
          status: product.status,
          paymentPolicy: product.paymentPolicy,
          isFeatured: product.isFeatured,
          isTrending: product.isTrending,
          isBestSeller: product.isBestSeller,
          variants: product.variants,
        }),
      });
    } catch (error) {
      console.error('Update product error:', error);
      return res.status(500).json({ message: 'Unable to update product' });
    }
  });
});

productRouter.patch('/:productId/featured', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawProductId = req.params.productId;
    if (typeof rawProductId !== 'string') {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const productId = rawProductId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const parsed = updateProductFeaturedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid product featured payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await ProductModel.findOne({ _id: productId, ownerId: req.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.isFeatured = parsed.data.isFeatured;
    await product.save();

    return res.status(200).json({
      product: toProductResponse({
        _id: product._id,
        title: product.title,
        category: product.category,
        price: product.price,
        discountType: product.discountType,
        discountValue: product.discountValue,
        imageUrl: product.imageUrl,
        status: product.status,
        paymentPolicy: product.paymentPolicy,
        isFeatured: product.isFeatured,
        isTrending: product.isTrending,
        isBestSeller: product.isBestSeller,
        variants: product.variants,
      }),
    });
  } catch (error) {
    console.error('Update product featured error:', error);
    return res.status(500).json({ message: 'Unable to update featured product state' });
  }
});

productRouter.patch('/:productId/trending', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawProductId = req.params.productId;
    if (typeof rawProductId !== 'string') {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    if (!mongoose.Types.ObjectId.isValid(rawProductId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const parsed = updateProductTrendingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid product trending payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await ProductModel.findOne({ _id: rawProductId, ownerId: req.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.isTrending = parsed.data.isTrending;
    await product.save();

    return res.status(200).json({
      product: toProductResponse({
        _id: product._id,
        title: product.title,
        category: product.category,
        price: product.price,
        discountType: product.discountType,
        discountValue: product.discountValue,
        imageUrl: product.imageUrl,
        status: product.status,
        paymentPolicy: product.paymentPolicy,
        isFeatured: product.isFeatured,
        isTrending: product.isTrending,
        isBestSeller: product.isBestSeller,
        variants: product.variants,
      }),
    });
  } catch (error) {
    console.error('Update product trending error:', error);
    return res.status(500).json({ message: 'Unable to update trending product state' });
  }
});

productRouter.patch('/:productId/best-seller', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawProductId = req.params.productId;
    if (typeof rawProductId !== 'string') {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    if (!mongoose.Types.ObjectId.isValid(rawProductId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const parsed = updateProductBestSellerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid product best seller payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await ProductModel.findOne({ _id: rawProductId, ownerId: req.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.isBestSeller = parsed.data.isBestSeller;
    await product.save();

    return res.status(200).json({
      product: toProductResponse({
        _id: product._id,
        title: product.title,
        category: product.category,
        price: product.price,
        discountType: product.discountType,
        discountValue: product.discountValue,
        imageUrl: product.imageUrl,
        status: product.status,
        paymentPolicy: product.paymentPolicy,
        isFeatured: product.isFeatured,
        isTrending: product.isTrending,
        isBestSeller: product.isBestSeller,
        variants: product.variants,
      }),
    });
  } catch (error) {
    console.error('Update product best seller error:', error);
    return res.status(500).json({ message: 'Unable to update best seller product state' });
  }
});

productRouter.patch('/:productId/flags', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawProductId = req.params.productId;
    if (typeof rawProductId !== 'string') {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    if (!mongoose.Types.ObjectId.isValid(rawProductId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const parsed = updateProductFlagsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid product flags payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await ProductModel.findOne({ _id: rawProductId, ownerId: req.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (typeof parsed.data.isFeatured === 'boolean') {
      product.isFeatured = parsed.data.isFeatured;
    }
    if (typeof parsed.data.isTrending === 'boolean') {
      product.isTrending = parsed.data.isTrending;
    }
    if (typeof parsed.data.isBestSeller === 'boolean') {
      product.isBestSeller = parsed.data.isBestSeller;
    }

    await product.save();

    return res.status(200).json({
      product: toProductResponse({
        _id: product._id,
        title: product.title,
        category: product.category,
        price: product.price,
        discountType: product.discountType,
        discountValue: product.discountValue,
        imageUrl: product.imageUrl,
        status: product.status,
        paymentPolicy: product.paymentPolicy,
        isFeatured: product.isFeatured,
        isTrending: product.isTrending,
        isBestSeller: product.isBestSeller,
        variants: product.variants,
      }),
    });
  } catch (error) {
    console.error('Update product flags error:', error);
    return res.status(500).json({ message: 'Unable to update product flags' });
  }
});

productRouter.delete('/:productId', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawProductId = req.params.productId;
    if (typeof rawProductId !== 'string') {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const productId = rawProductId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const product = await ProductModel.findOne({ _id: productId, ownerId: req.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const imageUrl = product.imageUrl;
    await ProductModel.deleteOne({ _id: productId, ownerId: req.userId });
    await removeUploadedImageIfPresent(imageUrl);
    await destroyImageByPublicId(getProductImagePublicId(productId));

    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ message: 'Unable to delete product' });
  }
});

export default productRouter;
