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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
