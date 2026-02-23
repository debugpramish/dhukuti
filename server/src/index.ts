import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', product: 'Dhukuti API' });
});

// ── Routes (add as you build them) ──────────
// app.use('/api/v1/auth',     authRoutes);
// app.use('/api/v1/products', productRoutes);
// app.use('/api/v1/orders',   orderRoutes);

// ── Database ────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI as string)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Dhukuti API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;
