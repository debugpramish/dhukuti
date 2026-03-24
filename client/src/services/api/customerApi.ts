import { httpRequest, unwrapData } from './httpClient';
import { getStoreSettings } from './storeApi';
import type {
    StoreCustomer,
    StoreCustomerListQuery,
    StoreCustomerListResult,
    StoreCustomerPagination,
} from './types';

type StoreCustomersPayload = StoreCustomerListResult | { customers: StoreCustomer[]; pagination?: Partial<StoreCustomerPagination> };
type StoreCustomersResponse = StoreCustomersPayload | { data: StoreCustomersPayload };

function toNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCustomer(customer: StoreCustomer): StoreCustomer {
    return {
        id: String(customer.id ?? ''),
        storeId: String(customer.storeId ?? ''),
        name: String(customer.name ?? ''),
        email: String(customer.email ?? ''),
        phone: String(customer.phone ?? ''),
        address: String(customer.address ?? ''),
        createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString() : new Date(0).toISOString(),
        updatedAt: customer.updatedAt ? new Date(customer.updatedAt).toISOString() : new Date(0).toISOString(),
    };
}

function normalizeCustomersPayload(payload: StoreCustomersPayload): StoreCustomerListResult {
    const customers = Array.isArray(payload.customers) ? payload.customers.map(normalizeCustomer) : [];

    const rawPagination = payload.pagination ?? {};
    const fallbackLimit = 20;
    const fallbackTotal = customers.length;

    const limit = Math.max(1, Math.floor(toNumber(rawPagination.limit, fallbackLimit)));
    const total = Math.max(0, Math.floor(toNumber(rawPagination.total, fallbackTotal)));
    const totalPages = Math.max(1, Math.floor(toNumber(rawPagination.totalPages, Math.ceil(total / limit) || 1)));
    const page = Math.min(
        totalPages,
        Math.max(1, Math.floor(toNumber(rawPagination.page, 1))),
    );

    return {
        customers,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: Boolean(rawPagination.hasNextPage ?? page < totalPages),
        },
    };
}

async function resolveStoreSlug(candidateSlug: string | undefined): Promise<string> {
    const normalizedCandidate = String(candidateSlug || '').trim().toLowerCase();
    if (normalizedCandidate) {
        return normalizedCandidate;
    }

    const settings = await getStoreSettings();
    const fallbackSlug = String(settings.slug || '').trim().toLowerCase();
    if (!fallbackSlug) {
        throw new Error('Store slug is required to fetch customers');
    }

    return fallbackSlug;
}

export async function getStoreCustomers(query: StoreCustomerListQuery = {}): Promise<StoreCustomerListResult> {
    const slug = await resolveStoreSlug(query.slug);
    const page = Math.max(1, Math.floor(toNumber(query.page, 1)));
    const limit = Math.min(100, Math.max(1, Math.floor(toNumber(query.limit, 20))));
    const search = String(query.search || '').trim();

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) {
        params.set('search', search);
    }

    const response = await httpRequest<StoreCustomersResponse>(
        `/api/auth/store/${encodeURIComponent(slug)}/customers?${params.toString()}`,
        { method: 'GET' },
    );

    return normalizeCustomersPayload(unwrapData<StoreCustomersPayload>(response));
}
