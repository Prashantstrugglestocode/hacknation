export function getPayoneDensity(): { density: 'low' | 'medium' | 'high'; label: string } {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 9) return { density: 'high', label: 'Morgenrush (sim.)' };
  if (hour >= 9 && hour < 11) return { density: 'medium', label: 'Ruhige Stunden (sim.)' };
  if (hour >= 11 && hour < 14) return { density: 'high', label: 'Mittagsrush (sim.)' };
  if (hour >= 14 && hour < 17) return { density: 'low', label: 'Ruhig gerade (sim.)' };
  if (hour >= 17 && hour < 20) return { density: 'high', label: 'Abendrush (sim.)' };
  return { density: 'low', label: 'Außerhalb (sim.)' };
}
