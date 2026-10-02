import whatsappCitiesData from '@/constants/whatsappCities.json';

export type WhatsAppCity = {
  value: string;
  label: string;
  state?: string;
  state_label?: string;
  raw_city?: string;
};

export const normalizeCitySearch = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const CITY_OPTIONS: WhatsAppCity[] = (() => {
  const raw: any = whatsappCitiesData as any;
  const cities = Array.isArray(raw) ? raw : Array.isArray(raw?.cities) ? raw.cities : [];
  return (cities || [])
    .map((c: any) => ({
      value: String(c?.value ?? '').trim(),
      label: String(c?.label ?? '').trim(),
      state: c?.state ? String(c.state).trim() : undefined,
      state_label: c?.state_label ? String(c.state_label).trim() : undefined,
      raw_city: c?.raw_city ? String(c.raw_city).trim() : undefined,
    }))
    .filter((c: WhatsAppCity) => c.value && c.label);
})();

export const CITY_BY_VALUE = new Map(CITY_OPTIONS.map((c) => [c.value, c]));
