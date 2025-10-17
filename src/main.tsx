import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import App from './App.tsx';
import './index.css';

// Create a client with optimized settings to prevent excessive requests
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // Data stays fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Cache for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on window focus
      retry: 1, // Only retry failed requests once
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);