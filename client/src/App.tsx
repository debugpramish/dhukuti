import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Pages (create these files as you build)
// import LoginPage      from './pages/LoginPage';
// import RegisterPage   from './pages/RegisterPage';
// import DashboardPage  from './pages/DashboardPage';
// import ProductsPage   from './pages/ProductsPage';
// import OrdersPage     from './pages/OrdersPage';
// import StorePage      from './pages/StorePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  1000 * 60 * 5,  // 5 minutes
      retry:      1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path='/login'       element={<div>Login Page</div>} />
          <Route path='/register'    element={<div>Register Page</div>} />
          <Route path='/dashboard'   element={<div>Dashboard</div>} />
          <Route path='/products'    element={<div>Products</div>} />
          <Route path='/orders'      element={<div>Orders</div>} />
          <Route path='/store/:slug' element={<div>Public Store</div>} />
          <Route path='/'            element={<Navigate to='/dashboard' replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}