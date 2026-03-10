import mongoose, { type Document, type Model, type Schema } from 'mongoose';

export const USER_ROLE_VALUES = ['merchant', 'customer'] as const;
export type UserRole = (typeof USER_ROLE_VALUES)[number];

export interface UserDocument extends Document {
  name: string;
  email: string;
  phone: string;
  address: string;
  passwordHash: string;
  role?: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: 'merchant',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const UserModel: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ||
  mongoose.model<UserDocument>('User', userSchema as Schema<UserDocument>);

export default UserModel;
