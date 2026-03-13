import express from 'express';
import { currentMerchant, loginMerchant, registerMerchant } from '../controllers/merchantAuth.controller';
import merchantRouter from './merchant.routes';
import customerRouter from './customer.routes';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';

const authRouter = express.Router();

// Backward-compatible merchant auth endpoints
authRouter.post('/signup', registerMerchant);
authRouter.post('/login', loginMerchant);
authRouter.get('/me', requireAuth, requireMerchant, currentMerchant);

// Namespaced routes
authRouter.use('/merchant', merchantRouter);
authRouter.use(['/store/:slug/customers', '/stores/:slug/customers'], customerRouter);

export default authRouter;
