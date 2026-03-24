import express from 'express';
import {
    currentCustomer,
    deleteCurrentCustomer,
    listStoreCustomers,
    loginCustomer,
    registerCustomer,
    updateCurrentCustomer,
} from '../controllers/customerAuth.controller';
import { resolveStore } from '../middleware/resolveStore.middleware';
import { requireAuth, requireCustomer, requireMerchant } from '../middleware/auth.middleware';

// mergeParams=true allows access to :slug from parent router
const customerRouter = express.Router({ mergeParams: true });

customerRouter.post('/register', resolveStore, registerCustomer);
customerRouter.post('/login', resolveStore, loginCustomer);
customerRouter.get('/me', requireAuth, requireCustomer, currentCustomer);
customerRouter.put('/me', requireAuth, requireCustomer, updateCurrentCustomer);
customerRouter.delete('/me', requireAuth, requireCustomer, deleteCurrentCustomer);
customerRouter.get('/', resolveStore, requireAuth, requireMerchant, listStoreCustomers);

export default customerRouter;
