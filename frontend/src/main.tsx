import '@mantine/core/styles.css';
import './index.css';
import { createTheme, MantineProvider, type MantineColorsTuple } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './App.tsx';
import { CurrencyProvider } from './currency.tsx';

// Deep "ledger" green, built around the chart colour #0e9472 (index 6).
const ledger: MantineColorsTuple = [
  '#e6f6f1', '#d3ece4', '#a8d8c8', '#79c4ab', '#52b393', '#37a883', '#0e9472', '#0b8264', '#057357', '#00634a',
];

const theme = createTheme({
  fontFamily: '"Public Sans", system-ui, sans-serif',
  headings: { fontFamily: '"Public Sans", system-ui, sans-serif', fontWeight: '650' },
  primaryColor: 'ledger',
  primaryShade: 8,
  colors: { ledger },
  defaultRadius: 'sm',
  // Checkboxes, switches, segmented controls and similar show a pointer, like links and buttons.
  cursorType: 'pointer',
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
          <RouterProvider router={router} />
        </CurrencyProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
