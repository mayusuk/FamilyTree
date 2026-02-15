import type { Person } from './types';

function normalizePart(value: string | undefined): string {
  return (value ?? '').trim();
}

export function composeFullNameFromParts(
  firstName: string,
  middleName?: string,
  surname?: string
): string {
  return [normalizePart(firstName), normalizePart(middleName), normalizePart(surname)]
    .filter(Boolean)
    .join(' ');
}

export function composeDisplayName(person: Person): string {
  const first = normalizePart(person.firstName);
  const last = normalizePart(person.surname);
  const combined = [first, last].filter(Boolean).join(' ');
  return combined || 'Unnamed';
}

export function getInitial(person: Person): string {
  const source = normalizePart(person.firstName) || normalizePart(person.surname);
  return source ? source.charAt(0).toUpperCase() : '?';
}

