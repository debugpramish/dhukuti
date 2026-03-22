import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';

import InventoryAdjustmentModal from '@/components/dashboard/InventoryAdjustmentModal';
import InventoryHistoryTable from '@/components/dashboard/InventoryHistoryTable';
import InventoryVariantModal from '@/components/dashboard/InventoryVariantModal';
import InventoryVariantTable from '@/components/dashboard/InventoryVariantTable';
import LowStockTable from '@/components/dashboard/LowStockTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adjustInventory, createVariant, getInventoryHistory, getLowStockAlerts, updateVariant } from '@/services/api/inventoryApi';
import { getProducts } from '@/services/api/productApi';
import type {
  InventoryAdjustmentInput,
  InventoryVariantCreateInput,
  InventoryVariantUpdateInput,
  Product,
  ProductVariant,
} from '@/services/api/types';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantModalMode, setVariantModalMode] = useState<'create' | 'edit'>('create');
  const [variantModalError, setVariantModalError] = useState<string | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustModalError, setAdjustModalError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [thresholdInput, setThresholdInput] = useState('');
  const [thresholdOverride, setThresholdOverride] = useState<number | undefined>(undefined);

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    retry: 1,
  });

  const lowStockQuery = useQuery({
    queryKey: ['inventory-low-stock', thresholdOverride ?? 'default'],
    queryFn: () => getLowStockAlerts(thresholdOverride),
    retry: 1,
  });

  const historyQuery = useQuery({
    queryKey: ['inventory-history', 'latest'],
    queryFn: () => getInventoryHistory({ limit: 50 }),
    retry: 1,
  });

  const createVariantMutation = useMutation({
    mutationFn: (payload: InventoryVariantCreateInput) => createVariant(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] }),
      ]);
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ variantId, payload }: { variantId: string; payload: InventoryVariantUpdateInput }) =>
      updateVariant(variantId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] }),
      ]);
    },
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: (payload: InventoryAdjustmentInput) => adjustInventory(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-history'] }),
      ]);
    },
  });

  const productTitleById = useMemo(() => {
    const lookup: Record<string, string> = {};
    (productsQuery.data ?? []).forEach((product) => {
      lookup[product.id] = product.title;
    });
    return lookup;
  }, [productsQuery.data]);

  const variantNameById = useMemo(() => {
    const lookup: Record<string, string> = {};
    (productsQuery.data ?? []).forEach((product) => {
      product.variants.forEach((variant) => {
        lookup[variant.id] = variant.name || 'Default';
      });
    });
    return lookup;
  }, [productsQuery.data]);

  const allVariants = useMemo(
    () =>
      (productsQuery.data ?? []).flatMap((product) =>
        product.variants.map((variant) => ({
          productId: product.id,
          productTitle: product.title,
          variant,
        })),
      ),
    [productsQuery.data],
  );

  const totalSkuCount = allVariants.length;

  const criticalCount = useMemo(() => {
    return allVariants.filter(({ variant }) => {
      const effectiveThreshold = thresholdOverride ?? variant.lowStockThreshold;
      return variant.stock <= effectiveThreshold * 0.3;
    }).length;
  }, [allVariants, thresholdOverride]);

  const lowStockCount = lowStockQuery.data?.length ?? 0;

  const openCreateVariantModal = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setVariantModalMode('create');
    setVariantModalError(null);
    setVariantModalOpen(true);
  };

  const openEditVariantModal = (product: Product, variant: ProductVariant) => {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setVariantModalMode('edit');
    setVariantModalError(null);
    setVariantModalOpen(true);
  };

  const openAdjustModal = (product: Product, variant: ProductVariant) => {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setAdjustModalError(null);
    setAdjustModalOpen(true);
  };

  const handleVariantSubmit = async (payload: InventoryVariantCreateInput | InventoryVariantUpdateInput) => {
    setVariantModalError(null);

    try {
      if (variantModalMode === 'create') {
        await createVariantMutation.mutateAsync(payload as InventoryVariantCreateInput);
      } else if (selectedVariant) {
        await updateVariantMutation.mutateAsync({
          variantId: selectedVariant.id,
          payload: payload as InventoryVariantUpdateInput,
        });
      }

      setVariantModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save variant.';
      setVariantModalError(message);
    }
  };

  const handleAdjustmentSubmit = async (payload: InventoryAdjustmentInput) => {
    setAdjustModalError(null);

    try {
      await adjustInventoryMutation.mutateAsync(payload);
      setAdjustModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to adjust inventory.';
      setAdjustModalError(message);
    }
  };

  const applyThresholdOverride = () => {
    const trimmed = thresholdInput.trim();
    if (!trimmed) {
      setThresholdOverride(undefined);
      return;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return;
    }

    setThresholdOverride(Math.max(0, numeric));
  };

  const exportInventoryCsv = () => {
    if (allVariants.length === 0) {
      return;
    }

    const lines = [
      ['Product', 'Variant', 'SKU', 'Stock', 'Threshold'].join(','),
      ...allVariants.map(({ productTitle, variant }) => {
        const escapedProduct = `"${productTitle.replace(/"/g, '""')}"`;
        const escapedVariant = `"${(variant.name || 'Default').replace(/"/g, '""')}"`;
        const escapedSku = `"${variant.sku.replace(/"/g, '""')}"`;
        return [escapedProduct, escapedVariant, escapedSku, variant.stock, variant.lowStockThreshold].join(',');
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const canCreateVariant = Boolean(productsQuery.data && productsQuery.data.length > 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#f4f6f9] font-['DM_Sans',_'Manrope',_'Segoe_UI',_sans-serif] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <header className="rounded-t-2xl border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory</h1>
            <p className="mt-2 text-sm text-slate-500">
              Track SKU-level stock, monitor low inventory, and keep a detailed history of adjustments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-lg border-slate-200 text-slate-600" onClick={exportInventoryCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              type="button"
              className="h-10 rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
              disabled={!canCreateVariant}
              onClick={() => {
                const firstProduct = productsQuery.data?.[0];
                if (firstProduct) {
                  openCreateVariantModal(firstProduct);
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Variant
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Total SKUs</p>
            <p className="mt-1 text-2xl font-bold text-sky-950">{totalSkuCount}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-900">Critical Alerts</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{criticalCount}</p>
          </div>
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">Low Stock Items</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{lowStockCount}</p>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Variant management</h2>
            <p className="text-sm text-slate-400">Add SKUs, set low-stock thresholds, and adjust inventory.</p>
          </div>

          <div className="p-5">
            {productsQuery.isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Loading products...
                </CardContent>
              </Card>
            ) : null}

            {productsQuery.isError ? (
              <Card>
                <CardHeader>
                  <CardTitle>Unable to load products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-destructive">
                    {productsQuery.error instanceof Error ? productsQuery.error.message : 'Request failed'}
                  </p>
                  <Button type="button" variant="outline" onClick={() => void productsQuery.refetch()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {!productsQuery.isLoading && !productsQuery.isError && productsQuery.data ? (
              <InventoryVariantTable
                products={productsQuery.data}
                onCreateVariant={openCreateVariantModal}
                onEditVariant={openEditVariantModal}
                onAdjustStock={openAdjustModal}
              />
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Low stock alerts</h2>
              <p className="text-sm text-slate-400">Review items at or below the low stock threshold.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Override threshold"
                value={thresholdInput}
                onChange={(event) => setThresholdInput(event.target.value)}
                className="h-9 w-44 border-slate-200 text-right"
              />
              <Button type="button" className="h-9 rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700" onClick={applyThresholdOverride}>
                Apply
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg border-slate-200 text-slate-600"
                onClick={() => {
                  setThresholdInput('');
                  setThresholdOverride(undefined);
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="p-5">
            {lowStockQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading low stock alerts...</p>
            ) : null}
            {lowStockQuery.isError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  {lowStockQuery.error instanceof Error ? lowStockQuery.error.message : 'Request failed'}
                </p>
                <Button type="button" variant="outline" onClick={() => void lowStockQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : null}
            {!lowStockQuery.isLoading && !lowStockQuery.isError && lowStockQuery.data ? (
              <LowStockTable alerts={lowStockQuery.data} />
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Inventory history</h2>
            <p className="text-sm text-slate-400">Latest 50 stock changes across your catalog.</p>
          </div>

          <div className="p-5">
            {historyQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading inventory history...</p>
            ) : null}
            {historyQuery.isError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  {historyQuery.error instanceof Error ? historyQuery.error.message : 'Request failed'}
                </p>
                <Button type="button" variant="outline" onClick={() => void historyQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : null}
            {!historyQuery.isLoading && !historyQuery.isError && historyQuery.data ? (
              <InventoryHistoryTable
                history={historyQuery.data}
                productTitleById={productTitleById}
                variantNameById={variantNameById}
              />
            ) : null}
          </div>
        </section>
      </main>

      <InventoryVariantModal
        mode={variantModalMode}
        open={variantModalOpen}
        product={selectedProduct}
        variant={selectedVariant}
        isSubmitting={createVariantMutation.isPending || updateVariantMutation.isPending}
        submitError={variantModalError}
        onOpenChange={(open) => {
          setVariantModalOpen(open);
          if (!open) {
            setVariantModalError(null);
            setSelectedVariant(null);
            setSelectedProduct(null);
          }
        }}
        onSubmit={handleVariantSubmit}
      />

      <InventoryAdjustmentModal
        open={adjustModalOpen}
        product={selectedProduct}
        variant={selectedVariant}
        isSubmitting={adjustInventoryMutation.isPending}
        submitError={adjustModalError}
        onOpenChange={(open) => {
          setAdjustModalOpen(open);
          if (!open) {
            setAdjustModalError(null);
            setSelectedVariant(null);
            setSelectedProduct(null);
          }
        }}
        onSubmit={handleAdjustmentSubmit}
      />
    </div>
  );
}
