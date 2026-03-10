export type ProductAvailability = 'in_stock' | 'out_of_stock' | 'preorder';

export type ProductSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'rating_desc'
  | 'popular'
  | 'best_seller'
  | 'discount_desc';

export type ProductVariant = {
  id: string;
  name: string;
  value: string;
  sku?: string;
  stock?: number;
  priceDelta?: number;
  isDefault?: boolean;
};

export type ProductReview = {
  id: string;
  author: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
};

export type ProductRating = {
  average: number;
  count: number;
};

export type StorefrontProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription?: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  discountPercent?: number;
  thumbnail: string;
  images: string[];
  rating: ProductRating;
  availability: ProductAvailability;
  stock: number;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  variants: ProductVariant[];
  reviews: ProductReview[];
  tags: string[];
};

export type ProductCategory = {
  key: string;
  label: string;
  image?: string;
  productCount?: number;
};

export type StorefrontStore = {
  slug: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  logoUrl?: string;
  shippingRules?: {
    baseFee: number;
    freeShippingAbove: number;
    codEnabled: boolean;
    codFee: number;
    defaultCourier: string;
    supportedCouriers: string[];
  };
};

export type ProductQueryInput = {
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability?: ProductAvailability;
  sort?: ProductSort;
  featured?: boolean;
  trending?: boolean;
  bestSeller?: boolean;
  query?: string;
};

export type ProductQueryMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ProductQueryResult = {
  items: StorefrontProduct[];
  meta: ProductQueryMeta;
};

export type WishlistItem = {
  productId: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  image: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  quantity: number;
  availability: ProductAvailability;
  variantId?: string;
  variantLabel?: string;
};

export type ShippingAddress = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

export type ShippingMethod = {
  id: string;
  label: string;
  price: number;
  eta: string;
};

export type PaymentMethod = 'cod' | 'card' | 'paypal' | 'esewa' | 'khalti';

export type CheckoutPayload = {
  items: Array<{
    productId: string;
    quantity: number;
    variantId?: string;
  }>;
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  paymentSessionId?: string;
};

export type CheckoutResponse = {
  id: string;
  orderId: string;
  orderNumber?: string;
};

export type OrderLineItem = {
  id: string;
  productId?: string;
  title: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  image?: string;
  variantLabel?: string;
};

export type PaymentSummary = {
  subtotal: number;
  discountTotal: number;
  shipping: number;
  tax: number;
  total: number;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  paymentMethod: string;
  estimatedDelivery?: string;
  shippingAddress: ShippingAddress;
  items: OrderLineItem[];
  payment: PaymentSummary;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  addresses?: ShippingAddress[];
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  address: string;
  password: string;
  phone: string;
};

export type CheckoutBill = {
  subtotal: number;
  productDiscountTotal: number;
  couponCode?: string;
  couponDiscountTotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  paymentMethod: 'cod' | 'esewa' | 'khalti';
  total: number;
};

export type CmsPage = {
  slug: string;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  body: string;
};

export type SearchSuggestion = {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  price: number;
};
