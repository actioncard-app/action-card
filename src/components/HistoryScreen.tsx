import { useEffect, useState } from 'react';
import type { Lang, SavedCard } from '../lib/types';
import { listCards, deleteCard } from '../lib/db';
import { DOC_TYPE_LABEL, formatDateShort, formatMoney } from '../lib/templates';
import { daysUntil } from '../lib/extract';
import { groupCards } from '../lib/saved';
import { countdown } from './CardView';
import { IconTrash, IconStack, IconCalendar, IconCoins, IconAlert } from './Icons';
import { isInstalled, isStoragePersisted } from '../lib/session';
import { useT, type Key } from '../lib/i18n';

export default function HistoryScreen({ onOpen, userLanguage }: { onOpen: (c: SavedCard) => void; userLanguage: Lang }) {
  const t = useT();
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { isStoragePersisted().then(setPersisted); }, []);
  const installed = isInstalled();
  const refresh = () => listCards().then(setCards).catch(() => setCards([]));
  useEffect(() => { refresh(); }, []);

  if (!cards) return <div className="history screen"><h2>{t('saved_cards')}</h2><div className="sk sk-block" aria-label={t('loading')} /></div>;
  return (
    <div className="history screen" data-testid="history">
      <h2>{t('saved_cards')}</h2>
      <p className="small muted">{t('stored_only')}</p>
      {!installed && persisted !== true && (
        <div className="keep-hint small" role="note" data-testid="storage-hint">
          <IconAlert size={18} />
          <span>{t('storage_hint')}</span>
        </div>
      )}
      {cards.length === 0 && <div className="empty"><span className="empty-ic" aria-hidden><IconStack size={28} /></span>{t('no_saved')}</div>}
      {(() => {
        const g = groupCards(cards);
        const sections: [string, Key, SavedCard[]][] = [['overdue', 'overdue', g.overdue], ['upcoming', 'coming_up', g.upcoming], ['none', 'no_deadline_found', g.none]];
        return sections.filter(([, , list]) => list.length > 0).map(([key, title, list]) => (
          <section key={key} className={`hist-group ${key}`} data-testid={`hist-${key}`}>
            {(key !== 'upcoming' || g.overdue.length > 0 || g.none.length > 0) && <h3 className="hist-head">{t(title)} <span className="hist-count">{list.length}</span></h3>}
            <ul className="hist-list">
        {list.map((s) => {
          const c = s.card;
          const dt = c.docType.value ?? 'unknown';
          const d = c.deadline.value ? daysUntil(c.deadline.value) : null;
          return (
            <li key={s.id} className="hist-item" data-testid="history-item">
              <button className="hist-open" onClick={() => onOpen(s)}>
                <img src={s.thumbnail} alt="" />
                <div className="hist-body">
                  <div className="hist-type">{DOC_TYPE_LABEL[dt][userLanguage]}</div>
                  <div className="hist-meta">
                    <span className="hist-line"><IconCalendar size={15} />{c.deadline.value ? <>{formatDateShort(c.deadline.value, userLanguage)} <span className={`days ${countdown(d!, t).cls}`}>{countdown(d!, t).txt}</span></> : <span className="muted">{t('no_deadline_found')}</span>}</span>
                    <span className="hist-line"><IconCoins size={15} />{c.amount.value ? formatMoney(c.amount.value.amount, c.amount.value.currency, userLanguage) : <span className="muted">{t('no_amount')}</span>}</span>
                  </div>
                  <div className="small muted">{t('saved_on', { date: formatDateShort(new Date(s.createdAt - new Date(s.createdAt).getTimezoneOffset() * 60000).toISOString().slice(0, 10), userLanguage) })}</div>
                </div>
              </button>
              {confirm === s.id ? (
                <div className="hist-confirm">
                  <button className="btn tiny danger" onClick={async () => { await deleteCard(s.id); setConfirm(null); refresh(); }} data-testid="confirm-delete">{t('delete')}</button>
                  <button className="btn tiny ghost" onClick={() => setConfirm(null)}>{t('keep')}</button>
                </div>
              ) : (
                <button className="btn tiny ghost del" onClick={() => setConfirm(s.id)} aria-label={t('delete_card')} data-testid="delete-btn"><IconTrash /></button>
              )}
            </li>
          );
        })}
            </ul>
          </section>
        ));
      })()}
    </div>
  );
}
