import { useEffect, useState } from 'react';
import type { Lang, SavedCard } from '../lib/types';
import { listCards, deleteCard } from '../lib/db';
import { DOC_TYPE_LABEL, formatDate, formatMoney } from '../lib/templates';
import { daysUntil } from '../lib/extract';
import { countdown } from './CardView';
import { IconTrash, IconStack, IconCalendar, IconCoins, IconAlert } from './Icons';
import { isInstalled, isStoragePersisted } from '../lib/session';

export default function HistoryScreen({ onOpen, userLanguage }: { onOpen: (c: SavedCard) => void; userLanguage: Lang }) {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { isStoragePersisted().then(setPersisted); }, []);
  const installed = isInstalled();
  const refresh = () => listCards().then(setCards).catch(() => setCards([]));
  useEffect(() => { refresh(); }, []);

  if (!cards) return <div className="history screen"><h2>Saved cards</h2><div className="sk sk-block" aria-label="Loading" /></div>;
  return (
    <div className="history screen" data-testid="history">
      <h2>Saved cards</h2>
      <p className="small muted">Stored only on this phone. Clearing your browser data removes them.</p>
      {!installed && persisted !== true && (
        <div className="keep-hint small" role="note" data-testid="storage-hint">
          <IconAlert size={18} />
          <span>The browser may delete saved cards if you don't open this app for about a week (Safari does this). To keep them, add the app to your Home Screen (Safari: Share → Add to Home Screen), and export a PDF of anything important.</span>
        </div>
      )}
      {cards.length === 0 && <div className="empty"><span className="empty-ic" aria-hidden><IconStack size={28} /></span>No saved cards yet. Scan a document and tap “Save card”.</div>}
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
                  <div className="hist-meta">
                    <span className="hist-line"><IconCalendar size={15} />{c.deadline.value ? <>{formatDate(c.deadline.value, userLanguage)} <span className={`days ${countdown(d!).cls}`}>{countdown(d!).txt}</span></> : <span className="muted">No deadline found</span>}</span>
                    <span className="hist-line"><IconCoins size={15} />{c.amount.value ? formatMoney(c.amount.value.amount, c.amount.value.currency, userLanguage) : <span className="muted">No amount</span>}</span>
                  </div>
                  <div className="small muted">Saved {new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
              </button>
              {confirm === s.id ? (
                <div className="hist-confirm">
                  <button className="btn tiny danger" onClick={async () => { await deleteCard(s.id); setConfirm(null); refresh(); }} data-testid="confirm-delete">Delete</button>
                  <button className="btn tiny ghost" onClick={() => setConfirm(null)}>Keep</button>
                </div>
              ) : (
                <button className="btn tiny ghost del" onClick={() => setConfirm(s.id)} aria-label="Delete card" data-testid="delete-btn"><IconTrash /></button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
