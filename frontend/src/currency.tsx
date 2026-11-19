import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { apiFetch } from './api/client';
import type { Meta } from './api/types';
import { convertMinor, formatMinor } from './lib/money';

/** 'local' shows each amount in its own currency; otherwise everything converts to this code. */
export type DisplayCurrency = 'local' | string;

const STORAGE_KEY = 'acme-display-currency';

const CurrencyContext = createContext<{ display: DisplayCurrency; setDisplay: (c: DisplayCurrency) => void } | null>(
  null,
);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [display, setDisplayState] = useState<DisplayCurrency>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? 'local';
    } catch {
      return 'local';
    }
  });
  const setDisplay = (c: DisplayCurrency) => {
    setDisplayState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // storage unavailable: the choice lasts for this visit only
    }
  };
  return <CurrencyContext.Provider value={{ display, setDisplay }}>{children}</CurrencyContext.Provider>;
}

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => apiFetch<Meta>('/api/meta'), staleTime: Infinity });

/** Display currency plus helpers to convert and format amounts for it. */
export function useMoney() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useMoney needs CurrencyProvider');
  const { data: meta } = useMeta();
  const rateOf = new Map(meta?.fxRates.map((r) => [r.currency, r.rateToUsd]) ?? []);
  const rateAsOf = meta?.fxRates[0]?.asOf;

  /** Converts to the display currency, or keeps the original when display is 'local' or rates are not loaded. */
  const convert = (amountMinor: number, currency: string) => {
    const from = rateOf.get(currency);
    const to = rateOf.get(ctx.display);
    if (ctx.display === 'local' || ctx.display === currency || !from || !to) return { amountMinor, currency };
    return { amountMinor: convertMinor(amountMinor, from, to), currency: ctx.display };
  };

  const format = (amountMinor: number, currency: string, opts?: { cents?: boolean }) => {
    const c = convert(amountMinor, currency);
    return formatMinor(c.amountMinor, c.currency, opts);
  };

  /** Currency for API calls that need one currency (departments, payroll). */
  const apiCurrency = ctx.display === 'local' ? 'USD' : ctx.display;

  return { ...ctx, convert, format, rateAsOf, apiCurrency, currencies: meta?.fxRates.map((r) => r.currency) ?? [] };
}
