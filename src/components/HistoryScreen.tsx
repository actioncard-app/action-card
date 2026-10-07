import { useEffect, useState } from 'react';
import type { Lang, SavedCard } from '../lib/types';
import { listCards, deleteCard } from '../lib/db';
import { DOC_TYPE_LABEL, formatDate, formatMoney } from '../lib/templates';
import { daysUntil } from '../lib/extract';

export default function HistoryScreen({ onOpen, userLanguage }: { onOpen: (c: SavedCard) => void; userLanguage: Lang }) {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const refresh = () => listCards().then(setCards).catch(() => setCards([]));
  useEffect(() => { refresh(); }, []);

  if (!cards) return <p className="muted">Loading…</p>;
  return (
    <div className="history" data-testid="history">
      <h2>Saved cards</h2>
      <p className="small muted">Stored only on this phone (IndexedDB). Clearing your browser data removes them.</p>
      {cards.length === 0 && <div className="empty">No saved cards yet. Scan a document and tap “Save card”.</div>}
      <ul className="hist-list">
        {cards.map((s) => {
          const c = s.card;
          const t = c.docType.value ?? 'unknown';
          const d = c.deadline.value ? daysUntil(c.deadline.value) : null;
          return (
            <li key={s.id} className="hist-item" data-testid="history-item">
              <button className="hist-open" onClick={() => onOpen(s)}>
                <img src={s.thumbnail} alt="" />
                <div className="hist-body">
                  <div className="hist-type">{DOC_TYPE_LABEL[t][userLanguage]}</div>
                  <div className="small">
                    {c.deadline.value ? <>{formatDate(c.deadline.value, userLanguage)} · <span className={d! < 0 ? 'past-txt' : d! <= 3 ? 'urgent-txt' : ''}>{d! < 0 ? `${-d!}d ago` : `${d}d left`}</span></> : <span className="muted">No deadline found</span>}
                  </div>
                  <div className="small muted">{c.amount.value ? formatMoney(c.amount.value.amount, c.amount.value.currency, userLanguage) : 'No amount'} · saved {new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
              </button>
              {confirm === s.id ? (
                <div className="hist-confirm">
                  <button className="btn tiny danger" onClick={async () => { await deleteCard(s.id); setConfirm(null); refresh(); }} data-testid="confirm-delete">Delete</button>
                  <button className="btn tiny ghost" onClick={() => setConfirm(null)}>Keep</button>
                </div>
              ) : (
                <button className="btn tiny ghost del" onClick={() => setConfirm(s.id)} aria-label="Delete card" data-testid="delete-btn">🗑</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
