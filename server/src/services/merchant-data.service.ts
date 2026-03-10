import StoreModel, { type StoreDocument } from '../models/store.model';
import UserModel from '../models/user.model';

const merchantStoreInitLocks = new Map<string, Promise<StoreDocument>>();

function slugify(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'store';
}

function buildStoreSlug(name: string, userId: string): string {
  const base = slugify(name).slice(0, 90);
  const suffix = userId.slice(-6).toLowerCase();
  return `${base}-${suffix}`;
}

export async function ensureMerchantStore(userId: string): Promise<StoreDocument> {
  const user = await UserModel.findById(userId);
  const defaultName = user?.name ? `${user.name}'s Store` : 'My Store';
  const fallbackSlug = buildStoreSlug(defaultName, userId);

  let store = await StoreModel.findOne({ ownerId: userId });
  if (!store) {
    store = await StoreModel.create({
      ownerId: userId,
      slug: fallbackSlug,
      name: defaultName,
      description: 'Template-powered storefront managed by merchant catalog data.',
      phone: user?.phone || '+1 555 0100',
      address: user?.address || '123 Main Street, Springfield',
      logoUrl: '',
    });

    return store;
  }

  if (!store.slug) {
    store.slug = fallbackSlug;
    await store.save();
  }

  return store;
}

// Ensures merchant base records exist without creating demo products/orders.
export async function ensureMerchantDemoData(userId: string) {
  const activeLock = merchantStoreInitLocks.get(userId);
  if (activeLock) {
    await activeLock;
    return;
  }

  const initTask = ensureMerchantStore(userId);
  merchantStoreInitLocks.set(userId, initTask);

  try {
    await initTask;
  } finally {
    merchantStoreInitLocks.delete(userId);
  }
}
