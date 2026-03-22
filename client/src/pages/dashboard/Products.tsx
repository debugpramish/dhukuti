'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Inbox } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  updateProductFlags,
} from '@/services/api/productApi';
import type { Product, ProductCreateInput, ProductUpdateInput } from '@/services/api/types';

interface DeleteAlert {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<DeleteAlert | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    price: 0,
    imageUrl: '',
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
  });

  const { data: products = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    retry: 1,
  });

  const createProductMutation = useMutation({
    mutationFn: (payload: ProductCreateInput) => createProduct(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
      showToast('Product created successfully');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unable to create product.';
      setModalError(message);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: ProductUpdateInput }) =>
      updateProduct(productId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
      showToast('Product updated successfully');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unable to update product.';
      setModalError(message);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) => deleteProduct(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteAlert(null);
      showToast('Product deleted');
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
      showToast('Product flags updated');
    },
  });

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      price: 0,
      imageUrl: '',
      isFeatured: false,
      isTrending: false,
      isBestSeller: false,
    });
    setModalError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setEditingProduct(null);
    resetForm();
  };

  const openAddModal = () => {
    resetForm();
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      title: product.title,
      price: product.price,
      imageUrl: product.imageUrl || '',
      isFeatured: product.isFeatured,
      isTrending: product.isTrending,
      isBestSeller: product.isBestSeller,
    });
    setModalError(null);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.title.trim() || formData.price < 0) {
      setModalError('Product name and valid price are required.');
      return;
    }

    try {
      if (isEditMode && editingProduct) {
        await updateProductMutation.mutateAsync({
          productId: editingProduct.id,
          payload: {
            price: formData.price,
            discountType: 'none',
            discountValue: 0,
          },
        });
      } else {
        await createProductMutation.mutateAsync({
          title: formData.title,
          category: 'Uncategorized',
          price: formData.price,
          discountType: 'none',
          discountValue: 0,
          status: 'active',
          isFeatured: formData.isFeatured,
          isTrending: formData.isTrending,
          isBestSeller: formData.isBestSeller,
        });
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleToggleFlag = async (
    product: Product,
    flag: 'isFeatured' | 'isTrending' | 'isBestSeller',
  ) => {
    try {
      await updateProductFlagsMutation.mutateAsync({
        productId: product.id,
        payload: {
          [flag]: !product[flag],
        },
      });
    } catch (err) {
      console.error('Toggle flag error:', err);
    }
  };

  const initiateDelete = (product: Product) => {
    setDeleteAlert({
      id: product.id,
      name: product.title,
    });
  };

  const confirmDelete = async () => {
    if (deleteAlert) {
      try {
        await deleteProductMutation.mutateAsync(deleteAlert.id);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-8 py-10">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Products</h1>
              <p className="mt-2 text-sm text-gray-600">
                Merchants create their own catalog. Image, pricing, and storefront tags can be managed here.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Product
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-8 py-8">
        {/* Delete Alert */}
        {deleteAlert && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-red-900">Delete "{deleteAlert.name}"?</p>
              <p className="text-xs text-red-800">This action cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={deleteProductMutation.isPending}
                className="rounded px-3 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteProductMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteAlert(null)}
                className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content Section */}
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-8 py-6">
            <h2 className="text-lg font-semibold text-gray-900">Product Catalog</h2>
          </div>

          {/* Empty State */}
          {!isLoading && !isError && products.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <Inbox size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No products available in your store yet.</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="py-16 text-center text-gray-500">
              <p className="text-sm">Loading products...</p>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="space-y-3 py-10 px-8">
              <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Failed to load products'}</p>
              <button
                onClick={() => void refetch()}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          {!isLoading && !isError && products.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th className="px-8 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Image</th>
                    <th className="px-8 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">
                      Product Name
                    </th>
                    <th className="px-8 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Price</th>
                    <th className="px-8 py-4 text-center font-semibold uppercase tracking-wider text-gray-600">
                      Featured
                    </th>
                    <th className="px-8 py-4 text-center font-semibold uppercase tracking-wider text-gray-600">
                      Trending
                    </th>
                    <th className="px-8 py-4 text-center font-semibold uppercase tracking-wider text-gray-600">
                      Best Seller
                    </th>
                    <th className="px-8 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      style={{ borderColor: '#e5e7eb' }}
                      className="border-t transition-colors hover:bg-gray-50"
                    >
                      <td className="px-8 py-4">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <p className="font-medium text-gray-900">{product.title}</p>
                        <p className="mt-1 text-xs text-gray-500">{product.category}</p>
                      </td>
                      <td className="px-8 py-4 font-semibold text-gray-900">₨{product.price.toFixed(2)}</td>
                      <td className="px-8 py-4 text-center">
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={product.isFeatured}
                            onChange={() => handleToggleFlag(product, 'isFeatured')}
                            className="sr-only"
                          />
                          <div
                            className={`h-5 w-9 rounded-full transition-colors ${product.isFeatured ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${product.isFeatured ? 'translate-x-4' : ''
                                }`}
                            />
                          </div>
                        </label>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={product.isTrending}
                            onChange={() => handleToggleFlag(product, 'isTrending')}
                            className="sr-only"
                          />
                          <div
                            className={`h-5 w-9 rounded-full transition-colors ${product.isTrending ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${product.isTrending ? 'translate-x-4' : ''
                                }`}
                            />
                          </div>
                        </label>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={product.isBestSeller}
                            onChange={() => handleToggleFlag(product, 'isBestSeller')}
                            className="sr-only"
                          />
                          <div
                            className={`h-5 w-9 rounded-full transition-colors ${product.isBestSeller ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${product.isBestSeller ? 'translate-x-4' : ''
                                }`}
                            />
                          </div>
                        </label>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => initiateDelete(product)}
                            className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Modal Backdrop */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          {/* Modal */}
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditMode ? 'Edit Product' : 'Add Product'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {isEditMode ? 'Update product details' : 'Create a new product for your catalog'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {modalError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {modalError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500"
                  placeholder="e.g., Premium Wireless Headphones"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Price</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">₨</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="border-t border-gray-200 pt-4">
                <p className="mb-3 text-sm font-medium text-gray-700">Storefront Flags</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className={`h-5 w-9 rounded-full transition-colors ${formData.isFeatured ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${formData.isFeatured ? 'translate-x-4' : ''
                          }`}
                      />
                    </div>
                    <span className="text-sm text-gray-700">Featured on homepage</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.isTrending}
                      onChange={(e) => setFormData({ ...formData, isTrending: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className={`h-5 w-9 rounded-full transition-colors ${formData.isTrending ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${formData.isTrending ? 'translate-x-4' : ''
                          }`}
                      />
                    </div>
                    <span className="text-sm text-gray-700">Mark as trending</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.isBestSeller}
                      onChange={(e) => setFormData({ ...formData, isBestSeller: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className={`h-5 w-9 rounded-full transition-colors ${formData.isBestSeller ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${formData.isBestSeller ? 'translate-x-4' : ''
                          }`}
                      />
                    </div>
                    <span className="text-sm text-gray-700">Best seller badge</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {createProductMutation.isPending || updateProductMutation.isPending
                    ? 'Saving...'
                    : `${isEditMode ? 'Update' : 'Save'} Product`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            backgroundColor: '#111827',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          className="fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium transition-all"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
