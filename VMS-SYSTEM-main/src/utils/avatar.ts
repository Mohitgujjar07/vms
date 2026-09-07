import { Visitor } from '../types';

/**
 * Ephemeral-photo policy helper.
 * Visitor photos are never stored, so every surface that previously showed a
 * photo falls back to a deterministic colored-initials avatar instead of an
 * external image fetch (fully offline, zero storage, zero network).
 */

const PALETTES = [
  ['#731A73', '#f3e8ff'], // purple
  ['#1d4ed8', '#dbeafe'], // blue
  ['#047857', '#d1fae5'], // emerald
  ['#b45309', '#fef3c7'], // amber
  ['#be123c', '#ffe4e6'], // rose
  ['#4338ca', '#e0e7ff']  // indigo
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase() || '?';
}

/** Inline SVG data-URI avatar with the visitor's initials — no network, no storage */
export function initialsAvatar(nameOrVisitor?: string | Pick<Visitor, 'name'>, size = 96): string {
  const name = typeof nameOrVisitor === 'string' ? nameOrVisitor : nameOrVisitor?.name;
  const [bg, fg] = PALETTES[hashName((name || '').toLowerCase()) % PALETTES.length];
  const initials = getInitials(name);
  const fontSize = Math.round(size * 0.38);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${bg}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">${initials}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
