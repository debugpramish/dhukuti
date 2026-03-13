import express from 'express';
import { currentMerchant, loginMerchant, registerMerchant } from '../controllers/merchantAuth.controller';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';

const merchantRouter = express.Router();

// Merchant auth
merchantRouter.post('/signup', registerMerchant);
merchantRouter.post('/login', loginMerchant);
merchantRouter.get('/me', requireAuth, requireMerchant, currentMerchant);

export default merchantRouter;
