import fs from 'fs/promises';
import path from 'path';
import type { CustomerDocument } from '../models/customer.model';

function slugifySegment(value: string, fallback: string): string {
    const normalized = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

function buildCustomerFileName(customer: CustomerDocument): string {
    const customerId = customer._id.toString();
    const safeName = slugifySegment(customer.name, 'customer');
    return `${safeName}-${customerId}.json`;
}

function getCustomersRootDirectory(): string {
    return path.resolve(process.cwd(), 'customers');
}

function getStoreDirectory(storeSlug: string): string {
    return path.resolve(getCustomersRootDirectory(), slugifySegment(storeSlug, 'store'));
}

function customerIdSuffix(customerId: string): string {
    return `-${customerId}.json`;
}

async function listCustomerFilesForId(storeSlug: string, customerId: string): Promise<string[]> {
    const storeDirectory = getStoreDirectory(storeSlug);

    try {
        const entries = await fs.readdir(storeDirectory, { withFileTypes: true });
        const expectedSuffix = customerIdSuffix(customerId);

        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(expectedSuffix))
            .map((entry) => path.resolve(storeDirectory, entry.name));
    } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode === 'ENOENT') {
            return [];
        }

        throw error;
    }
}

async function removeFiles(filePaths: string[]): Promise<void> {
    await Promise.all(
        filePaths.map(async (filePath) => {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                const errorCode = (error as NodeJS.ErrnoException).code;
                if (errorCode !== 'ENOENT') {
                    throw error;
                }
            }
        }),
    );
}

export async function writeCustomerToStoreFolder(params: {
    storeSlug: string;
    customer: CustomerDocument;
}): Promise<string> {
    const storeDirectory = getStoreDirectory(params.storeSlug);

    await fs.mkdir(storeDirectory, { recursive: true });

    const filePath = path.resolve(storeDirectory, buildCustomerFileName(params.customer));
    const payload = {
        id: params.customer._id.toString(),
        storeId: params.customer.storeId.toString(),
        name: params.customer.name,
        email: params.customer.email,
        phone: params.customer.phone,
        address: params.customer.address,
        createdAt: params.customer.createdAt,
        updatedAt: params.customer.updatedAt,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return filePath;
}

// Idempotent upsert: rewrites current customer file and removes stale name-based copies.
export async function upsertCustomerInStoreFolder(params: {
    storeSlug: string;
    customer: CustomerDocument;
}): Promise<string> {
    const writtenFilePath = await writeCustomerToStoreFolder(params);
    const allFilesForCustomer = await listCustomerFilesForId(params.storeSlug, params.customer._id.toString());

    const staleFiles = allFilesForCustomer.filter((filePath) => filePath !== writtenFilePath);
    if (staleFiles.length > 0) {
        await removeFiles(staleFiles);
    }

    return writtenFilePath;
}

export async function deleteCustomerFromStoreFolder(params: {
    storeSlug: string;
    customerId: string;
}): Promise<number> {
    const files = await listCustomerFilesForId(params.storeSlug, params.customerId);
    if (files.length === 0) {
        return 0;
    }

    await removeFiles(files);
    return files.length;
}
