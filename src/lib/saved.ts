import type { SavedCard } from './types';
import { daysUntil } from './extract';

/** Saved list order: overdue first (most recently missed on top), then upcoming by nearest deadline, then cards
 *  without a deadline (newest first). */
export function groupCards(cards: SavedCard[], now = new Date()): { overdue: SavedCard[]; upcoming: SavedCard[]; none: SavedCard[] } {
  const dl = (s: SavedCard) => s.card.deadline.value!;
  const withD = cards.filter((s) => s.card.deadline.value);
  return {
    overdue: withD.filter((s) => daysUntil(dl(s), now) < 0).sort((a, b) => dl(b).localeCompare(dl(a))),
    upcoming: withD.filter((s) => daysUntil(dl(s), now) >= 0).sort((a, b) => dl(a).localeCompare(dl(b)) || b.createdAt - a.createdAt),
    none: cards.filter((s) => !s.card.deadline.value).sort((a, b) => b.createdAt - a.createdAt),
  };
}
