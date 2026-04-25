export interface PayoneSignal {
  density: 'low' | 'medium' | 'high';
  label: string;
  labelDe: string;
}

export function getPayoneSignal(): PayoneSignal {
  const hour = new Date().getHours();
  // Deterministic by hour, honestly labeled as simulated
  if (hour >= 7 && hour < 9) return { density: 'high', label: 'Morning rush (sim.)', labelDe: 'Morgenrush (sim.)' };
  if (hour >= 9 && hour < 11) return { density: 'medium', label: 'Morning quiet (sim.)', labelDe: 'Ruhige Stunden (sim.)' };
  if (hour >= 11 && hour < 14) return { density: 'high', label: 'Lunch rush (sim.)', labelDe: 'Mittagsrush (sim.)' };
  if (hour >= 14 && hour < 17) return { density: 'low', label: 'Quiet now (sim.)', labelDe: 'Ruhig gerade (sim.)' };
  if (hour >= 17 && hour < 20) return { density: 'high', label: 'Evening rush (sim.)', labelDe: 'Abendrush (sim.)' };
  return { density: 'low', label: 'Off-hours (sim.)', labelDe: 'Außerhalb (sim.)' };
}
