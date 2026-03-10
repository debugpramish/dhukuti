import express from 'express';
import mongoose from 'mongoose';

import InventoryLogModel from '../models/inventory-log.model';
import ProductModel, { type ProductDocument, type ProductVariant } from '../models/product.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import {
  createVariantSchema,
  inventoryAdjustmentSchema,
  updateVariantSchema,
} from '../validation/inventory.validation';

const inventoryRouter = express.Router();

function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

function findVariant(product: ProductDocument, variantId: string): ProductVariant | undefined {
  return product.variants.find((variant) => variant._id.toString() === variantId);
}

function ensureUniqueSku(product: ProductDocument, sku: string, excludeVariantId?: string) {
  const normalizedSku = normalizeSku(sku);
  const conflict = product.variants.some(
    (variant) => normalizeSku(variant.sku) === normalizedSku && variant._id.toString() !== excludeVariantId,
  );

  if (conflict) {
    throw new Error('SKU already exists for this product');
  }
}

function setDefaultVariant(product: ProductDocument, targetVariantId: string) {
  product.variants = product.variants.map((variant) => ({
    ...variant,
    isDefault: variant._id.toString() === targetVariantId,
  }));
}

inventoryRouter.post('/variants', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = createVariantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid variant payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await ProductModel.findOne({ _id: parsed.data.productId, ownerId: req.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    ensureUniqueSku(product, parsed.data.sku);

    const variant: ProductVariant = {
      _id: new mongoose.Types.ObjectId(),
      sku: normalizeSku(parsed.data.sku),
      name: parsed.data.name?.trim() || 'Default',
      stock: parsed.data.stock ?? 0,
      lowStockThreshold: parsed.data.lowStockThreshold ?? 5,
      isDefault: Boolean(parsed.data.isDefault),
    };

    product.variants.push(variant);

    if (variant.isDefault || product.variants.length === 1) {
      setDefaultVariant(product, variant._id.toString());
    }

    await product.save();

    return res.status(201).json({
      variant: {
        id: variant._id.toString(),
        sku: variant.sku,
        name: variant.name,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isDefault: variant.isDefault,
        productId: product._id.toString(),
        productTitle: product.title,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create variant';
    return res.status(500).json({ message });
  }
});

inventoryRouter.patch('/variants/:variantId', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const variantId = String(req.params.variantId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ message: 'Invalid variant id' });
    }

    const parsed = updateVariantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid variant update payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await ProductModel.findOne({ ownerId: req.userId, 'variants._id': variantId });
    if (!product) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    const variant = findVariant(product, variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    if (parsed.data.sku) {
      ensureUniqueSku(product, parsed.data.sku, variantId);
      variant.sku = normalizeSku(parsed.data.sku);
    }

    if (typeof parsed.data.name === 'string') {
      variant.name = parsed.data.name.trim() || variant.name;
    }

    if (typeof parsed.data.lowStockThreshold === 'number') {
      variant.lowStockThreshold = parsed.data.lowStockThreshold;
    }

    if (typeof parsed.data.isDefault === 'boolean' && parsed.data.isDefault) {
      setDefaultVariant(product, variantId);
    }

    await product.save();

    return res.status(200).json({
      variant: {
        id: variant._id.toString(),
        sku: variant.sku,
        name: variant.name,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isDefault: variant.isDefault,
        productId: product._id.toString(),
        productTitle: product.title,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update variant';
    return res.status(500).json({ message });
  }
});

inventoryRouter.post('/adjustments', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = inventoryAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid inventory adjustment payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const product = await ProductModel.findOne({ _id: parsed.data.productId, ownerId: req.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const variant = findVariant(product, parsed.data.variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    const stockBefore = Number(variant.stock ?? 0);
    let stockAfter = stockBefore;

    if (parsed.data.adjustmentType === 'set') {
      stockAfter = parsed.data.quantity;
    } else if (parsed.data.adjustmentType === 'increase') {
      stockAfter = stockBefore + parsed.data.quantity;
    } else {
      stockAfter = stockBefore - parsed.data.quantity;
    }

    if (stockAfter < 0) {
      return res.status(400).json({ message: 'Stock cannot go below zero' });
    }

    variant.stock = stockAfter;
    await product.save();

    await InventoryLogModel.create({
      ownerId: req.userId,
      productId: product._id,
      variantId: variant._id,
      sku: variant.sku,
      change: stockAfter - stockBefore,
      stockBefore,
      stockAfter,
      reason: parsed.data.reason,
      note: parsed.data.note,
    });

    return res.status(200).json({
      variant: {
        id: variant._id.toString(),
        sku: variant.sku,
        name: variant.name,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isDefault: variant.isDefault,
        productId: product._id.toString(),
        productTitle: product.title,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to adjust inventory';
    return res.status(500).json({ message });
  }
});

inventoryRouter.get('/low-stock', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const thresholdRaw = Number(req.query.threshold);
    const threshold = Number.isFinite(thresholdRaw) ? Math.max(thresholdRaw, 0) : null;

    const products = await ProductModel.find({ ownerId: req.userId }).select({ title: 1, variants: 1 });

    const alerts = products.flatMap((product) =>
      product.variants
        .filter((variant) => {
          const limit = threshold ?? variant.lowStockThreshold ?? 0;
          return Number(variant.stock ?? 0) <= limit;
        })
        .map((variant) => ({
          productId: product._id.toString(),
          productTitle: product.title,
          variantId: variant._id.toString(),
          sku: variant.sku,
          variantName: variant.name,
          stock: variant.stock,
          lowStockThreshold: variant.lowStockThreshold,
        })),
    );

    return res.status(200).json({ alerts });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    return res.status(500).json({ message: 'Unable to load low stock alerts' });
  }
});

inventoryRouter.get('/history', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;

    const filter: Record<string, unknown> = { ownerId: req.userId };

    if (typeof req.query.productId === 'string' && mongoose.Types.ObjectId.isValid(req.query.productId)) {
      filter.productId = req.query.productId;
    }

    if (typeof req.query.variantId === 'string' && mongoose.Types.ObjectId.isValid(req.query.variantId)) {
      filter.variantId = req.query.variantId;
    }

    if (typeof req.query.sku === 'string' && req.query.sku.trim()) {
      filter.sku = normalizeSku(req.query.sku);
    }

    const logs = await InventoryLogModel.find(filter).sort({ createdAt: -1 }).limit(limit);

    return res.status(200).json({
      history: logs.map((log) => ({
        id: log._id.toString(),
        productId: log.productId.toString(),
        variantId: log.variantId.toString(),
        sku: log.sku,
        change: log.change,
        stockBefore: log.stockBefore,
        stockAfter: log.stockAfter,
        reason: log.reason,
        note: log.note,
        referenceType: log.referenceType,
        referenceId: log.referenceId?.toString(),
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get inventory history error:', error);
    return res.status(500).json({ message: 'Unable to load inventory history' });
  }
});

export default inventoryRouter;
