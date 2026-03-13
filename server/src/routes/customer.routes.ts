import express from 'express';
import { currentCustomer, loginCustomer, registerCustomer } from '../controllers/customerAuth.controller';
import { resolveStore } from '../middleware/resolveStore.middleware';
import { requireAuth, requireCustomer } from '../middleware/auth.middleware';

// mergeParams=true allows access to :slug from parent router
const customerRouter = express.Router({ mergeParams: true });

customerRouter.post('/register', resolveStore, registerCustomer);
customerRouter.post('/login', resolveStore, loginCustomer);
customerRouter.get('/me', requireAuth, requireCustomer, currentCustomer);

export default customerRouter;
