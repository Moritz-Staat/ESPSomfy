import { LIMITS } from './enums';

// Namen für Rollos, Räume und Gruppen teilen dieselbe Grenze: char name[21] in
// Somfy.h, also 20 Zeichen. Die Firmware schneidet längere Namen still ab —
// die App lehnt sie stattdessen sichtbar ab.
export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Der Name darf nicht leer sein.';
  if (trimmed.length > LIMITS.maxNameLength) {
    return `Höchstens ${LIMITS.maxNameLength} Zeichen (aktuell ${trimmed.length}).`;
  }
  return null;
}

// Fahrzeiten kommen als Text aus dem Eingabefeld. Leer heißt „unverändert lassen".
export function validateDuration(value: string): string | null {
  if (value === '') return null;
  if (!/^\d+$/.test(value)) return 'Nur ganze Zahlen in Millisekunden.';
  return null;
}
