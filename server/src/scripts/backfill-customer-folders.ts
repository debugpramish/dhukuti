import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CustomerModel from '../models/customer.model';
import StoreModel from '../models/store.model';
import { upsertCustomerInStoreFolder } from '../services/customer-folder.service';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI ?? '';

if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables');
}

async function run() {
    await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 20000,
    });

    const customers = await CustomerModel.find({}).sort({ createdAt: 1 });
    let migratedCount = 0;
    let skippedCount = 0;

    for (const customer of customers) {
        const store = await StoreModel.findById(customer.storeId).select({ slug: 1 }).lean();
        if (!store?.slug) {
            skippedCount += 1;
            continue;
        }

        await upsertCustomerInStoreFolder({
            storeSlug: store.slug,
            customer,
        });

        migratedCount += 1;
    }

    console.log(`Backfill complete. Migrated: ${migratedCount}, skipped: ${skippedCount}`);
}

void run()
    .catch((error) => {
        console.error('Backfill customer folders failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
