import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  createOrder,
  fetchStorefrontStore,
  initiateStorePayment,
  previewCheckoutBill,
  verifyStorePayment,
} from '@/features/storefront/api/storefrontApi';
import { formatCurrency } from '@/features/storefront/utils';
import type {
  CheckoutBill,
  CheckoutPayload,
  PaymentMethod,
  ShippingAddress,
  ShippingMethod,
} from '@/features/storefront/types';
import { useSeo } from '@/hooks/use-seo';
import { useStorefrontAuthStore } from '@/stores/storefront-auth-store';
import { getCartItemCount, useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'esewa', label: 'eSewa' },
  { value: 'khalti', label: 'Khalti' },
];

const checkoutSteps = ['Shipping Address', 'Shipping Method', 'Payment Method', 'Order Summary'] as const;

function isAddressComplete(address: ShippingAddress): boolean {
  return Boolean(
    address.name.trim() &&
      address.email.trim() &&
      address.phone.trim() &&
      address.address.trim() &&
      address.city.trim() &&
      address.postalCode.trim() &&
      address.country.trim(),
  );
}

export default function CheckoutPage() {
  useSeo({
    title: 'Checkout',
    description: 'Complete shipping, payment, and order summary to place your order.',
  });

  const navigate = useNavigate();
  const pushToast = useStorefrontUiStore((state) => state.pushToast);

  const { items, cartTotal, clearCart } = useStorefrontCartStore();
  const itemCount = getCartItemCount(items);
  const { isAuthenticated, token, user } = useStorefrontAuthStore();

  const storeQuery = useQuery({
    queryKey: ['storefront', 'store-info'],
    queryFn: fetchStorefrontStore,
    retry: 0,
  });

  const shippingMethods = useMemo<ShippingMethod[]>(() => {
    const baseFee = Math.max(0, storeQuery.data?.shippingRules?.baseFee ?? 0);

    return [
      {
        id: 'standard',
        label: 'Standard Shipping',
        price: baseFee,
        eta: '3-7 business days',
      },
    ];
  }, [storeQuery.data?.shippingRules?.baseFee]);

  const initialAddress: ShippingAddress = useMemo(
    () => ({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.addresses?.[0]?.address || user?.addresses?.[0]?.city || '',
      city: user?.addresses?.[0]?.city || '',
      postalCode: user?.addresses?.[0]?.postalCode || '',
      country: user?.addresses?.[0]?.country || 'Nepal',
    }),
    [user],
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(initialAddress);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(shippingMethods[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [couponCode, setCouponCode] = useState('');
  const [previewBill, setPreviewBill] = useState<CheckoutBill | null>(null);
  const [paymentSessionId, setPaymentSessionId] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (shippingMethods.length > 0) {
      setShippingMethod(shippingMethods[0]);
    }
  }, [shippingMethods]);

  useEffect(() => {
    setPreviewBill(null);
    setPaymentSessionId('');
    setPaymentVerified(false);
  }, [couponCode, paymentMethod, shippingAddress, items]);

  const buildCheckoutPayload = (): CheckoutPayload => ({
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      variantId: item.variantId,
    })),
    shippingAddress,
    shippingMethod,
    paymentMethod,
    couponCode: couponCode.trim() || undefined,
    paymentSessionId: paymentSessionId || undefined,
  });

  const summary = useMemo(() => {
    if (previewBill) {
      return {
        subtotal: previewBill.subtotal,
        productDiscountTotal: previewBill.productDiscountTotal,
        couponDiscountTotal: previewBill.couponDiscountTotal,
        discountTotal: previewBill.discountTotal,
        shipping: previewBill.shippingFee,
        codFee: previewBill.codFee,
        total: previewBill.total,
      };
    }

    const shipping = shippingMethod.price;
    const discountTotal = 0;
    const total = Math.max(0, cartTotal - discountTotal + shipping);

    return {
      subtotal: cartTotal,
      productDiscountTotal: 0,
      couponDiscountTotal: 0,
      discountTotal,
      shipping,
      codFee: paymentMethod === 'cod' ? Math.max(0, storeQuery.data?.shippingRules?.codFee ?? 0) : 0,
      total,
    };
  }, [cartTotal, paymentMethod, previewBill, shippingMethod.price, storeQuery.data?.shippingRules?.codFee]);

  if (!isAuthenticated || !token) {
    return <Navigate to={`/login?next=${encodeURIComponent('/checkout')}`} replace />;
  }

  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const handleAddressSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAddressComplete(shippingAddress)) {
      pushToast({
        variant: 'error',
        title: 'Incomplete address',
        description: 'Fill all shipping fields to continue.',
      });
      return;
    }

    setCurrentStep(1);
  };

  const handleReviewSummary = async () => {
    if (!isAddressComplete(shippingAddress)) {
      pushToast({ variant: 'error', title: 'Shipping address required' });
      setCurrentStep(0);
      return;
    }

    setIsReviewing(true);

    try {
      const bill = await previewCheckoutBill(buildCheckoutPayload(), token);
      setPreviewBill(bill);
      pushToast({
        variant: 'success',
        title: 'Order summary updated',
        description: `Total ${formatCurrency(bill.total)}`,
      });
    } catch (error) {
      pushToast({
        variant: 'error',
        title: 'Unable to review order',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (paymentMethod === 'cod') {
      pushToast({
        variant: 'info',
        title: 'No online verification required for COD',
      });
      return;
    }

    if (!previewBill) {
      await handleReviewSummary();
    }

    setIsVerifyingPayment(true);

    try {
      const initiated = await initiateStorePayment(buildCheckoutPayload(), token);
      const verification = await verifyStorePayment(initiated.paymentSessionId, token);

      if (!verification.verified) {
        throw new Error('Payment verification did not complete');
      }

      setPaymentSessionId(initiated.paymentSessionId);
      setPaymentVerified(true);
      setPreviewBill(initiated.bill);

      pushToast({
        variant: 'success',
        title: 'Payment verified',
        description: initiated.paymentSessionId,
      });
    } catch (error) {
      setPaymentSessionId('');
      setPaymentVerified(false);
      pushToast({
        variant: 'error',
        title: 'Payment verification failed',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!isAddressComplete(shippingAddress)) {
      pushToast({
        variant: 'error',
        title: 'Shipping address required',
      });
      setCurrentStep(0);
      return;
    }

    if (!previewBill) {
      await handleReviewSummary();
      return;
    }

    if (paymentMethod !== 'cod' && !paymentVerified) {
      pushToast({
        variant: 'error',
        title: 'Verify payment first',
        description: `Complete ${paymentMethod === 'esewa' ? 'eSewa' : 'Khalti'} verification before placing the order.`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createOrder(buildCheckoutPayload(), token);
      clearCart();
      pushToast({
        variant: 'success',
        title: 'Order placed successfully',
        description: result.orderNumber || result.orderId,
      });
      navigate(`/order-confirmation/${encodeURIComponent(result.orderId)}`);
    } catch (error) {
      pushToast({
        variant: 'error',
        title: 'Order placement failed',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-7">
      <section className="storefront-panel relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative">
          <span className="storefront-kicker">Secure Checkout</span>
          <h1 className="storefront-heading mt-2 text-3xl font-semibold text-slate-900">Complete Your Order</h1>
          <p className="text-sm text-slate-600">{itemCount} items in your order.</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="storefront-panel space-y-4 p-5">
          <ol className="flex flex-wrap gap-2 text-xs sm:text-sm">
            {checkoutSteps.map((step, index) => (
              <li
                key={step}
                className={`rounded-full px-3 py-1.5 ${index === currentStep ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {index + 1}. {step}
              </li>
            ))}
          </ol>

          {currentStep === 0 ? (
            <form onSubmit={handleAddressSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-600">Full name</span>
                  <input
                    value={shippingAddress.name}
                    onChange={(event) => setShippingAddress((state) => ({ ...state, name: event.target.value }))}
                    className="storefront-input"
                    required
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-600">Email</span>
                  <input
                    type="email"
                    value={shippingAddress.email}
                    onChange={(event) => setShippingAddress((state) => ({ ...state, email: event.target.value }))}
                    className="storefront-input"
                    required
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-600">Phone</span>
                  <input
                    value={shippingAddress.phone}
                    onChange={(event) => setShippingAddress((state) => ({ ...state, phone: event.target.value }))}
                    className="storefront-input"
                    required
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-600">City</span>
                  <input
                    value={shippingAddress.city}
                    onChange={(event) => setShippingAddress((state) => ({ ...state, city: event.target.value }))}
                    className="storefront-input"
                    required
                  />
                </label>

                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-slate-600">Address</span>
                  <input
                    value={shippingAddress.address}
                    onChange={(event) => setShippingAddress((state) => ({ ...state, address: event.target.value }))}
                    className="storefront-input"
                    required
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-600">Postal code</span>
                  <input
                    value={shippingAddress.postalCode}
                    onChange={(event) => setShippingAddress((state) => ({ ...state, postalCode: event.target.value }))}
                    className="storefront-input"
                    required
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-600">Country</span>
                  <input
                    value={shippingAddress.country}
                    onChange={(event) => setShippingAddress((state) => ({ ...state, country: event.target.value }))}
                    className="storefront-input"
                    required
                  />
                </label>
              </div>

              <Button type="submit" className="rounded-full px-5">Continue to Shipping Method</Button>
            </form>
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-3">
              {shippingMethods.map((method) => (
                <label key={method.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="shipping-method"
                      checked={shippingMethod.id === method.id}
                      onChange={() => setShippingMethod(method)}
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{method.label}</span>
                      <span className="text-slate-500">{method.eta}</span>
                    </span>
                  </span>
                  <span className="font-medium text-slate-900">{formatCurrency(method.price)}</span>
                </label>
              ))}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(0)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setCurrentStep(2)}>
                  Continue to Payment Method
                </Button>
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                  />
                  <span className="font-medium text-slate-900">{method.label}</span>
                </label>
              ))}

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-600">Coupon code (optional)</span>
                <input
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  className="storefront-input"
                  placeholder="ENTER CODE"
                />
              </label>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setCurrentStep(3)}>
                  Continue to Summary
                </Button>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="font-medium text-slate-900">Shipping Address</p>
                <p className="mt-1 text-slate-600">
                  {shippingAddress.name}, {shippingAddress.phone}
                </p>
                <p className="text-slate-600">
                  {shippingAddress.address}, {shippingAddress.city}, {shippingAddress.postalCode}, {shippingAddress.country}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="font-medium text-slate-900">Shipping & Payment</p>
                <p className="mt-1 text-slate-600">{shippingMethod.label} ({shippingMethod.eta})</p>
                <p className="text-slate-600">Payment: {PAYMENT_METHODS.find((item) => item.value === paymentMethod)?.label}</p>
                {paymentMethod !== 'cod' ? (
                  <p className={`mt-1 text-xs ${paymentVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {paymentVerified
                      ? `Payment verified (${paymentSessionId})`
                      : 'Payment verification required before placing order.'}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                  Back
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleReviewSummary()} disabled={isReviewing}>
                  {isReviewing ? 'Updating...' : 'Refresh Summary'}
                </Button>
                {paymentMethod !== 'cod' ? (
                  <Button type="button" variant="outline" onClick={() => void handleVerifyPayment()} disabled={isVerifyingPayment}>
                    {isVerifyingPayment ? 'Verifying...' : 'Verify Payment'}
                  </Button>
                ) : null}
                <Button type="button" onClick={() => void handlePlaceOrder()} disabled={isSubmitting || isReviewing || isVerifyingPayment}>
                  {isSubmitting ? 'Placing Order...' : 'Place Order'}
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="storefront-panel space-y-3 p-4 text-sm">
          <h2 className="storefront-heading text-xl font-semibold text-slate-900">Order Summary</h2>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={`${item.productId}:${item.variantId || 'default'}`} className="flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-slate-600">{item.title} x {item.quantity}</p>
                <p className="text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(summary.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Product discount</span>
              <span>-{formatCurrency(summary.productDiscountTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Coupon discount</span>
              <span>-{formatCurrency(summary.couponDiscountTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Shipping</span>
              <span>{formatCurrency(summary.shipping)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>COD fee</span>
              <span>{formatCurrency(summary.codFee)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(summary.total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
