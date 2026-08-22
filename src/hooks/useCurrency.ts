import { useOrganization } from '@/contexts/OrganizationContext';
import { OrganizationSettings } from '@/services/organizations.service';

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$',  label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€',  label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£',  label: 'British Pound (GBP)' },
  { code: 'INR', symbol: '₹',  label: 'Indian Rupee (INR)' },
  { code: 'JPY', symbol: '¥',  label: 'Japanese Yen (JPY)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (CAD)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (AUD)' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (SGD)' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc (CHF)' },
  { code: 'CNY', symbol: '¥',  label: 'Chinese Yuan (CNY)' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real (BRL)' },
  { code: 'MXN', symbol: '$',  label: 'Mexican Peso (MXN)' },
  { code: 'KRW', symbol: '₩',  label: 'South Korean Won (KRW)' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham (AED)' },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

export function useCurrency() {
  const { currentOrganization } = useOrganization();
  const settings = (currentOrganization?.settings ?? {}) as OrganizationSettings;
  const currencyCode = (settings.currency || 'USD') as CurrencyCode;

  const meta = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode)
    ?? SUPPORTED_CURRENCIES[0];

  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: currencyCode === 'JPY' || currencyCode === 'KRW' ? 0 : 2,
        maximumFractionDigits: currencyCode === 'JPY' || currencyCode === 'KRW' ? 0 : 2,
      }).format(amount);
    } catch {
      return `${meta.symbol}${amount.toFixed(2)}`;
    }
  };

  return { currencyCode, currencySymbol: meta.symbol, currencyLabel: meta.label, formatCurrency };
}
