import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ProductModel, { type ProductVariant } from '../models/product.model';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI ?? '';
const MONGODB_URI_DIRECT = process.env.MONGODB_URI_DIRECT ?? '';

if (!MONGODB_URI && !MONGODB_URI_DIRECT) {
  throw new Error('Missing MONGODB_URI (or MONGODB_URI_DIRECT) in environment variables.');
}

function buildDefaultVariant(productId: string): ProductVariant {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const skuSeed = productId.slice(-6).toUpperCase();

  return {
    _id: new mongoose.Types.ObjectId(),
    sku: `SKU-${skuSeed}-${Date.now().toString(36).toUpperCase()}-${suffix}`,
    name: 'Default',
    stock: 0,
    lowStockThreshold: 5,
    isDefault: true,
  };
}

async function connectToMongo() {
  const connectOptions = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 20000,
  };

  try {
    await mongoose.connect(MONGODB_URI || MONGODB_URI_DIRECT, connectOptions);
  } catch (primaryError) {
    const message = primaryError instanceof Error ? primaryError.message : '';
    if (message.includes('querySrv') && MONGODB_URI_DIRECT) {
      console.error('Primary Mongo URI failed with SRV DNS error. Trying MONGODB_URI_DIRECT fallback...');
      await mongoose.connect(MONGODB_URI_DIRECT, connectOptions);
      return;
    }

    throw primaryError;
  }
}

async function migrateDefaultVariants() {
  await connectToMongo();

  const products = await ProductModel.find({
    $or: [{ variants: { $exists: false } }, { variants: { $size: 0 } }],
  }).select({ _id: 1, variants: 1 });

  const bulkOps: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }> = [];

  for (const product of products) {
    const productId = product._id.toString();
    const variant = buildDefaultVariant(productId);

    bulkOps.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $set: { variants: [variant] } },
      },
    });
  }

  let updatedCount = 0;
  if (bulkOps.length > 0) {
    const result = await ProductModel.bulkWrite(bulkOps);
    updatedCount = result.modifiedCount ?? 0;
  }

  console.log(`Default variants created for ${updatedCount} products.`);

  const productsMissingDefault = await ProductModel.find({
    variants: { $exists: true, $ne: [] },
    'variants.isDefault': { $ne: true },
  }).select({ _id: 1, variants: 1 });

  let defaultFixedCount = 0;
  if (productsMissingDefault.length > 0) {
    const fixOps = productsMissingDefault.map((product) => {
      const updatedVariants = product.variants.map((variant, index) => ({
        _id: variant._id,
        sku: variant.sku,
        name: variant.name,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isDefault: index === 0,
      }));

      return {
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { variants: updatedVariants } },
        },
      };
    });

    const fixResult = await ProductModel.bulkWrite(fixOps);
    defaultFixedCount = fixResult.modifiedCount ?? 0;
  }

  if (defaultFixedCount > 0) {
    console.log(`Marked default variants for ${defaultFixedCount} products that lacked one.`);
  }
}

migrateDefaultVariants()
  .catch((error) => {
    console.error('Variant migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit();
  });
