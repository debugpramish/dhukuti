import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import ProductCreateModal from '@/components/dashboard/ProductCreateModal';
import ProductEditModal from '@/components/dashboard/ProductEditModal';
import ProductTable from '@/components/dashboard/ProductTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  updateProductFlags,
} from '@/services/api/productApi';
import type { Product, ProductCreateInput, ProductUpdateInput } from '@/services/api/types';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    retry: 1,
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: ProductUpdateInput }) =>
      updateProduct(productId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (payload: ProductCreateInput) => createProduct(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) => deleteProduct(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateProductFlagsMutation = useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: string;
      payload: Partial<Pick<Product, 'isFeatured' | 'isTrending' | 'isBestSeller'>>;
    }) => updateProductFlags(productId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const handleSubmitCreate = async (payload: ProductCreateInput) => {
    setCreateModalError(null);

    try {
      await createProductMutation.mutateAsync(payload);
      setIsCreateModalOpen(false);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to create product.';
      setCreateModalError(message);
    }
  };

  const handleDelete = async (product: Product) => {
    const shouldDelete = window.confirm(`Delete "${product.title}" from your catalog?`);
    if (!shouldDelete) {
      return;
    }

    setDeleteError(null);

    try {
      await deleteProductMutation.mutateAsync(product.id);

      if (editingProduct?.id === product.id) {
        setIsModalOpen(false);
        setEditingProduct(null);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to delete product.';
      setDeleteError(message);
    }
  };

  const handleToggleFlag = async (
    product: Product,
    flag: 'isFeatured' | 'isTrending' | 'isBestSeller',
  ) => {
    setFlagError(null);

    try {
      await updateProductFlagsMutation.mutateAsync({
        productId: product.id,
        payload: {
          [flag]: !product[flag],
        },
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to update product tags.';
      setFlagError(message);
    }
  };

  const handleCreateModalStateChange = (open: boolean) => {
    setIsCreateModalOpen(open);
    if (!open) {
      setCreateModalError(null);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmitEdit = async (payload: ProductUpdateInput) => {
    if (!editingProduct) {
      return;
    }

    setModalError(null);

    try {
      await updateProductMutation.mutateAsync({
        productId: editingProduct.id,
        payload,
      });
      setIsModalOpen(false);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to update product.';
      setModalError(message);
    }
  };

  const handleModalStateChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setModalError(null);
      setEditingProduct(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground">
          Merchants create their own catalog. Image, pricing, and storefront tags can be managed here.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => setIsCreateModalOpen(true)}>
          Add Product
        </Button>
      </div>

      {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
      {flagError ? <p className="text-sm text-destructive">{flagError}</p> : null}

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading products...
          </CardContent>
        </Card>
      ) : null}

      {isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Request failed'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && products && products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No products available in your store yet.
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && products && products.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Product Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductTable
              products={products}
              deletingProductId={deleteProductMutation.isPending ? (deleteProductMutation.variables ?? null) : null}
              updatingFlagsProductId={
                updateProductFlagsMutation.isPending ? (updateProductFlagsMutation.variables?.productId ?? null) : null
              }
              onEdit={handleEdit}
              onDelete={(product) => void handleDelete(product)}
              onToggleFlag={(product, flag) => void handleToggleFlag(product, flag)}
            />
          </CardContent>
        </Card>
      ) : null}

      <ProductEditModal
        product={editingProduct}
        open={isModalOpen}
        onOpenChange={handleModalStateChange}
        onSubmit={handleSubmitEdit}
        submitError={modalError}
        isSubmitting={updateProductMutation.isPending}
      />

      <ProductCreateModal
        open={isCreateModalOpen}
        onOpenChange={handleCreateModalStateChange}
        onSubmit={handleSubmitCreate}
        submitError={createModalError}
        isSubmitting={createProductMutation.isPending}
      />
    </div>
  );
}
