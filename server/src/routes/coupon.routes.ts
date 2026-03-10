import express from 'express';
import mongoose from 'mongoose';

import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import CouponModel from '../models/coupon.model';
import {
  createCouponSchema,
  updateCouponSchema,
  updateCouponStatusSchema,
} from '../validation/coupon.validation';

const couponRouter = express.Router();

function toCouponResponse(coupon: {
  _id: mongoose.Types.ObjectId;
  code: string;
  type: string;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: coupon._id.toString(),
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minOrderAmount: coupon.minOrderAmount,
    maxDiscountAmount: coupon.maxDiscountAmount,
    isActive: coupon.isActive,
    usageLimit: coupon.usageLimit,
    usageCount: coupon.usageCount,
    expiresAt: coupon.expiresAt,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

couponRouter.get('/', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const coupons = await CouponModel.find({ ownerId: req.userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      coupons: coupons.map((coupon) =>
        toCouponResponse({
          _id: coupon._id,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minOrderAmount: coupon.minOrderAmount,
          maxDiscountAmount: coupon.maxDiscountAmount,
          isActive: coupon.isActive,
          usageLimit: coupon.usageLimit,
          usageCount: coupon.usageCount,
          expiresAt: coupon.expiresAt,
          createdAt: coupon.createdAt,
          updatedAt: coupon.updatedAt,
        }),
      ),
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    return res.status(500).json({ message: 'Unable to load coupons' });
  }
});

couponRouter.post('/', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = createCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid coupon payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const couponCode = parsed.data.code.toUpperCase();
    const existingCoupon = await CouponModel.findOne({ ownerId: req.userId, code: couponCode });
    if (existingCoupon) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }

    const coupon = await CouponModel.create({
      ownerId: req.userId,
      code: couponCode,
      type: parsed.data.type,
      value: parsed.data.value,
      minOrderAmount: parsed.data.minOrderAmount,
      maxDiscountAmount: parsed.data.maxDiscountAmount,
      isActive: parsed.data.isActive,
      usageLimit: parsed.data.usageLimit,
      expiresAt: parsed.data.expiresAt,
      usageCount: 0,
    });

    return res.status(201).json({
      coupon: toCouponResponse({
        _id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        isActive: coupon.isActive,
        usageLimit: coupon.usageLimit,
        usageCount: coupon.usageCount,
        expiresAt: coupon.expiresAt,
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt,
      }),
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    return res.status(500).json({ message: 'Unable to create coupon' });
  }
});

couponRouter.put('/:couponId', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const couponId = String(req.params.couponId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ message: 'Invalid coupon id' });
    }

    const parsed = updateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid coupon payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const coupon = await CouponModel.findOne({ _id: couponId, ownerId: req.userId });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    const couponCode = parsed.data.code.toUpperCase();
    const duplicateCoupon = await CouponModel.findOne({
      _id: { $ne: coupon._id },
      ownerId: req.userId,
      code: couponCode,
    });

    if (duplicateCoupon) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }

    coupon.code = couponCode;
    coupon.type = parsed.data.type;
    coupon.value = parsed.data.value;
    coupon.minOrderAmount = parsed.data.minOrderAmount;
    coupon.maxDiscountAmount = parsed.data.maxDiscountAmount;
    coupon.isActive = parsed.data.isActive;
    coupon.usageLimit = parsed.data.usageLimit;
    coupon.expiresAt = parsed.data.expiresAt;
    await coupon.save();

    return res.status(200).json({
      coupon: toCouponResponse({
        _id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        isActive: coupon.isActive,
        usageLimit: coupon.usageLimit,
        usageCount: coupon.usageCount,
        expiresAt: coupon.expiresAt,
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt,
      }),
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    return res.status(500).json({ message: 'Unable to update coupon' });
  }
});

couponRouter.patch('/:couponId/active', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const couponId = String(req.params.couponId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ message: 'Invalid coupon id' });
    }

    const parsed = updateCouponStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid coupon status payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const coupon = await CouponModel.findOne({ _id: couponId, ownerId: req.userId });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    coupon.isActive = parsed.data.isActive;
    await coupon.save();

    return res.status(200).json({
      coupon: toCouponResponse({
        _id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        isActive: coupon.isActive,
        usageLimit: coupon.usageLimit,
        usageCount: coupon.usageCount,
        expiresAt: coupon.expiresAt,
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt,
      }),
    });
  } catch (error) {
    console.error('Update coupon status error:', error);
    return res.status(500).json({ message: 'Unable to update coupon status' });
  }
});

couponRouter.delete('/:couponId', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const couponId = String(req.params.couponId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ message: 'Invalid coupon id' });
    }

    const deletedCoupon = await CouponModel.findOneAndDelete({ _id: couponId, ownerId: req.userId });
    if (!deletedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    return res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    return res.status(500).json({ message: 'Unable to delete coupon' });
  }
});

export default couponRouter;
