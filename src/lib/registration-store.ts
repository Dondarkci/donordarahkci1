export interface LocationOption {
  id: string;
  label: string;
  maxQuota: number;
}

export interface DonorRecord {
  id: string;
  fullName: string;
  ktpNumber: string;
  whatsappNumber: string;
  locationId: string;
  locationLabel: string;
  timestamp: string;
}

export const LOCATION_OPTIONS: LocationOption[] = [
  { id: 'a', label: 'Stasiun Juanda 30 Maret 2026', maxQuota: 5 },
  { id: 'b', label: 'GTO Stasiun Depok 30 Maret 2026', maxQuota: 5 },
  { id: 'c', label: 'Stasiun Juanda 31 Maret 2026', maxQuota: 5 },
  { id: 'd', label: 'Stasiun BNI City 31 Maret 2026', maxQuota: 5 },
];

const STORAGE_KEY = 'kci_donor_registrations';

export function getRegistrations(): DonorRecord[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveRegistration(record: Omit<DonorRecord, 'id' | 'timestamp'>) {
  const registrations = getRegistrations();
  const newRecord: DonorRecord = {
    ...record,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  registrations.push(newRecord);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
  return newRecord;
}

export function clearRegistrations() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getQuotas() {
  const registrations = getRegistrations();
  const counts: Record<string, number> = {};
  LOCATION_OPTIONS.forEach(opt => counts[opt.id] = 0);
  registrations.forEach(reg => {
    counts[reg.locationId] = (counts[reg.locationId] || 0) + 1;
  });
  return counts;
}

export function isQuotaAvailable(locationId: string) {
  const counts = getQuotas();
  const option = LOCATION_OPTIONS.find(o => o.id === locationId);
  if (!option) return false;
  return counts[locationId] < option.maxQuota;
}
