import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRouter from './routes/auth.routes';
import dashboardRouter from './routes/dashboard.routes';
import orderRouter from './routes/order.routes';
import productRouter from './routes/product.routes';
import storeRouter from './routes/store.routes';
import publicStoreRouter from './routes/public-store.routes';
import couponRouter from './routes/coupon.routes';
import inventoryRouter from './routes/inventory.routes';
import reportsRouter from './routes/reports.routes';
import fulfillmentRouter from './routes/fulfillment.routes';
import abandonedCartRouter from './routes/abandoned-cart.routes';
import financeRouter from './routes/finance.routes';
import analyticsRouter from './routes/analytics.routes';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MONGODB_URI = process.env.MONGODB_URI ?? '';
const MONGODB_URI_DIRECT = process.env.MONGODB_URI_DIRECT ?? '';

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment variables');
}

// Fail fast for DB ops when the connection is unstable/unavailable.
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 5000);

// ── Middleware ──────────────────────────────
app.use(
  helmet({
    // Allow frontend origin (e.g. localhost:5173) to render uploaded images from this API origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin: CLIENT_URL,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ── Health check ────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', product: 'Dhukuti API' });
});

// ── Routes ──────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/store', storeRouter);
app.use('/api/v1/coupons', couponRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/fulfillment', fulfillmentRouter);
app.use('/api/v1/abandoned-carts', abandonedCartRouter);
app.use('/api/v1/finance', financeRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/public', publicStoreRouter);

// Backward-compatible aliases for the current frontend service paths.
app.use('/api/v1/api/dashboard', dashboardRouter);
app.use('/api/v1/api/products', productRouter);
app.use('/api/v1/api/orders', orderRouter);
app.use('/api/v1/api/store', storeRouter);
app.use('/api/v1/api/coupons', couponRouter);
app.use('/api/v1/api/inventory', inventoryRouter);
app.use('/api/v1/api/reports', reportsRouter);
app.use('/api/v1/api/fulfillment', fulfillmentRouter);
app.use('/api/v1/api/abandoned-carts', abandonedCartRouter);
app.use('/api/v1/api/finance', financeRouter);
app.use('/api/v1/api/analytics', analyticsRouter);

// ── Database ────────────────────────────────
mongoose.connection.on('error', (error) => {
  console.error('MongoDB runtime error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

type ErrorWithMessage = {
  message?: string;
};

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as ErrorWithMessage).message ?? '');
  }

  return '';
}

function printMongoHints(error: unknown) {
  const message = getErrorMessage(error);

  if (message.includes('querySrv')) {
    console.error('Mongo hint: SRV DNS lookup failed. Use a standard non-SRV URI in MONGODB_URI_DIRECT.');
  }

  if (message.includes("isn't whitelisted") || message.includes('Could not connect to any servers')) {
    console.error('Mongo hint: Add your current public IP to Atlas Network Access allowlist.');
  }
}

async function bootstrap() {
  try {
    const connectOptions = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    };

    try {
      await mongoose.connect(MONGODB_URI, connectOptions);
    } catch (primaryError) {
      const primaryMessage = getErrorMessage(primaryError);

      if (primaryMessage.includes('querySrv') && MONGODB_URI_DIRECT) {
        console.error('Primary Mongo URI failed with SRV DNS error. Trying MONGODB_URI_DIRECT fallback...');
        await mongoose.connect(MONGODB_URI_DIRECT, connectOptions);
      } else {
        throw primaryError;
      }
    }

    // Validate the active topology before accepting requests.
    await mongoose.connection.db?.admin().ping();

    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Dhukuti API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    printMongoHints(error);
    process.exit(1);
  }
}

void bootstrap();

export default app;
