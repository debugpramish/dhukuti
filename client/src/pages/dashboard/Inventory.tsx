import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Track SKU-level stock, monitor low inventory, and keep a detailed history of adjustments.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Variant management</h2>
            <p className="text-sm text-muted-foreground">Add SKUs, set low-stock thresholds, and adjust inventory.</p>
          </div>
        </div>

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

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Low stock alerts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review items at or below the low stock threshold.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min="0"
              placeholder="Override threshold"
              value={thresholdInput}
              onChange={(event) => setThresholdInput(event.target.value)}
              className="w-40"
            />
            <Button type="button" variant="outline" onClick={applyThresholdOverride}>
              Apply
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setThresholdInput('');
                setThresholdOverride(undefined);
              }}
            >
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory history</CardTitle>
          <p className="text-sm text-muted-foreground">Latest 50 stock changes across your catalog.</p>
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>

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
