import { z } from 'zod';

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().email('Please enter a valid email address'),
    phone: z.string().trim().min(7, 'Please enter a valid phone number'),
    address: z.string().trim().min(5, 'Address must be at least 5 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm password is required'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Password and confirm password must match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const customerProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name is too long').optional(),
    email: z.string().trim().email('Please enter a valid email address').optional(),
    phone: z.string().trim().min(7, 'Please enter a valid phone number').max(30, 'Phone number is too long').optional(),
    address: z.string().trim().min(5, 'Address must be at least 5 characters').max(500, 'Address is too long').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: [],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerProfileUpdateInput = z.infer<typeof customerProfileUpdateSchema>;
