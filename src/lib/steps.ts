// Step checklist: the next action broken into 2-4 concrete steps per document type. Card content, so the steps use
// the card's language (like the next action). Ticks are stored on the card (card.stepsDone), not globally.
// Order of every entry: [en, de, fr, es, it, pt]. {date} is the deadline in the card language; steps with a
// date have a variant without it for cards where no deadline was found.
import type { ActionCard, DocType, Lang } from './types';
import { LANGS } from './types';
import { formatDate } from './templates';

type Six = readonly [string, string, string, string, string, string];
interface Step { d?: Six; n: Six }

const KEEP: Step = { n: ['Keep the document and a copy of everything you send or pay.', 'Bewahren Sie das Schreiben und eine Kopie von allem auf, was Sie senden oder zahlen.', 'Conservez le document et une copie de tout ce que vous envoyez ou payez.', 'Guarde el documento y una copia de todo lo que envíe o pague.', 'Conserva il documento e una copia di tutto ciò che invii o paghi.', 'Guarde o documento e uma cópia de tudo o que enviar ou pagar.'] };

const STEPS: Record<DocType, Step[]> = {
  parking_fine: [
    { n: ['Check the date, place and number plate on the original.', 'Prüfen Sie Datum, Ort und Kennzeichen im Original.', "Vérifiez la date, le lieu et la plaque d'immatriculation sur l'original.", 'Compruebe la fecha, el lugar y la matrícula en el original.', "Controlla data, luogo e targa sull'originale.", 'Verifique a data, o local e a matrícula no original.'] },
    { d: ['Pay by {date}, quoting the reference number.', 'Zahlen Sie bis {date} und geben Sie das Aktenzeichen an.', 'Payez avant le {date} en indiquant la référence.', 'Pague antes del {date} indicando la referencia.', 'Paga entro il {date} indicando il riferimento.', 'Pague até {date}, indicando a referência.'],
      n: ['Pay as the document says, quoting the reference number.', 'Zahlen Sie wie im Schreiben angegeben und nennen Sie das Aktenzeichen.', 'Payez comme indiqué sur le document, en indiquant la référence.', 'Pague como indica el documento, indicando la referencia.', 'Paga come indicato nel documento, indicando il riferimento.', 'Pague como indicado no documento, indicando a referência.'] },
    { n: ['If you think it is wrong, contest it in writing before the deadline.', 'Wenn Sie es für falsch halten, widersprechen Sie schriftlich vor Fristablauf.', "Si vous pensez qu'il y a une erreur, contestez par écrit avant la date limite.", 'Si cree que es un error, recurra por escrito antes del plazo.', 'Se pensi che sia sbagliata, fai ricorso per iscritto prima della scadenza.', 'Se achar que está errado, conteste por escrito antes do prazo.'] },
    KEEP,
  ],
  medicine_label: [
    { n: ['Read the full label and the package leaflet.', 'Lesen Sie das ganze Etikett und den Beipackzettel.', "Lisez toute l'étiquette et la notice.", 'Lea toda la etiqueta y el prospecto.', "Leggi tutta l'etichetta e il foglietto illustrativo.", 'Leia o rótulo completo e o folheto informativo.'] },
    { n: ['Ask a pharmacist or doctor how to take it.', 'Fragen Sie in der Apotheke oder ärztlich nach, wie es einzunehmen ist.', 'Demandez à un pharmacien ou à un médecin comment le prendre.', 'Pregunte a un farmacéutico o a un médico cómo tomarlo.', 'Chiedi a un farmacista o a un medico come prenderlo.', 'Pergunte a um farmacêutico ou médico como o tomar.'] },
    { d: ['Do not use it after {date}.', 'Nach dem {date} nicht mehr verwenden.', 'Ne pas utiliser après le {date}.', 'No lo use después del {date}.', 'Non usarlo dopo il {date}.', 'Não use depois de {date}.'],
      n: ['Check the expiry date on the pack before use.', 'Prüfen Sie vor der Anwendung das Verfallsdatum auf der Packung.', "Vérifiez la date de péremption sur la boîte avant l'utilisation.", 'Compruebe la fecha de caducidad en el envase antes de usarlo.', "Controlla la data di scadenza sulla confezione prima dell'uso.", 'Verifique o prazo de validade na embalagem antes de usar.'] },
  ],
  airline_cancellation: [
    { n: ['Decide: refund or a new flight.', 'Entscheiden Sie: Erstattung oder neuer Flug.', 'Choisissez : remboursement ou nouveau vol.', 'Decida: reembolso o un vuelo nuevo.', 'Decidi: rimborso o un nuovo volo.', 'Decida: reembolso ou um novo voo.'] },
    { d: ['Send your request by {date}.', 'Senden Sie Ihren Antrag bis {date}.', 'Envoyez votre demande avant le {date}.', 'Envíe su solicitud antes del {date}.', 'Invia la tua richiesta entro il {date}.', 'Envie o seu pedido até {date}.'],
      n: ['Send your request as soon as possible.', 'Senden Sie Ihren Antrag so bald wie möglich.', 'Envoyez votre demande dès que possible.', 'Envíe su solicitud lo antes posible.', 'Invia la tua richiesta il prima possibile.', 'Envie o seu pedido o mais cedo possível.'] },
    { n: ['Quote the booking reference and keep all emails.', 'Geben Sie die Buchungsnummer an und bewahren Sie alle E-Mails auf.', 'Indiquez la référence de réservation et gardez tous les e-mails.', 'Indique la referencia de la reserva y guarde todos los correos.', 'Indica il codice di prenotazione e conserva tutte le e-mail.', 'Indique a referência da reserva e guarde todos os e-mails.'] },
  ],
  hotel_cancellation: [
    { n: ['Decide whether you keep the booking.', 'Entscheiden Sie, ob Sie die Buchung behalten.', 'Décidez si vous gardez la réservation.', 'Decida si mantiene la reserva.', 'Decidi se mantenere la prenotazione.', 'Decida se mantém a reserva.'] },
    { d: ['If not, cancel before {date} to avoid the charge.', 'Falls nicht, stornieren Sie vor dem {date}, um die Gebühr zu vermeiden.', 'Sinon, annulez avant le {date} pour éviter les frais.', 'Si no, cancele antes del {date} para evitar el cargo.', 'Se no, cancella prima del {date} per evitare l\'addebito.', 'Se não, cancele antes de {date} para evitar a cobrança.'],
      n: ['If not, cancel in time to avoid the charge.', 'Falls nicht, stornieren Sie rechtzeitig, um die Gebühr zu vermeiden.', 'Sinon, annulez à temps pour éviter les frais.', 'Si no, cancele a tiempo para evitar el cargo.', "Se no, cancella in tempo per evitare l'addebito.", 'Se não, cancele a tempo para evitar a cobrança.'] },
    { n: ['Keep the cancellation confirmation.', 'Bewahren Sie die Stornobestätigung auf.', "Gardez la confirmation d'annulation.", 'Guarde la confirmación de la cancelación.', 'Conserva la conferma di cancellazione.', 'Guarde a confirmação do cancelamento.'] },
  ],
  visa_entry: [
    { n: ['List every document the letter asks for.', 'Notieren Sie alle Unterlagen, die das Schreiben verlangt.', 'Listez toutes les pièces demandées dans la lettre.', 'Haga una lista de todos los documentos que pide la carta.', 'Elenca tutti i documenti richiesti dalla lettera.', 'Faça a lista de todos os documentos pedidos na carta.'] },
    { n: ['Pay any fee the letter mentions and keep the receipt.', 'Zahlen Sie eine genannte Gebühr und bewahren Sie den Beleg auf.', 'Payez les frais mentionnés et gardez le reçu.', 'Pague la tasa que se mencione y guarde el justificante.', 'Paga eventuali tasse indicate e conserva la ricevuta.', 'Pague a taxa indicada e guarde o comprovativo.'] },
    { d: ['Send or bring everything by {date}.', 'Senden oder bringen Sie alles bis {date}.', 'Envoyez ou apportez tout avant le {date}.', 'Envíe o lleve todo antes del {date}.', 'Invia o porta tutto entro il {date}.', 'Envie ou entregue tudo até {date}.'],
      n: ['Send or bring everything in time; ask the office if the date is unclear.', 'Senden oder bringen Sie alles rechtzeitig; fragen Sie bei der Behörde nach, wenn die Frist unklar ist.', "Envoyez ou apportez tout à temps ; demandez à l'administration si la date n'est pas claire.", 'Envíe o lleve todo a tiempo; pregunte a la oficina si la fecha no está clara.', "Invia o porta tutto in tempo; chiedi all'ufficio se la data non è chiara.", 'Envie ou entregue tudo a tempo; pergunte aos serviços se a data não for clara.'] },
    KEEP,
  ],
  rental_move_in: [
    { n: ['Check every room and take dated photos of any damage.', 'Prüfen Sie jeden Raum und fotografieren Sie Schäden mit Datum.', 'Vérifiez chaque pièce et photographiez les dégâts avec la date.', 'Revise cada habitación y haga fotos con fecha de cualquier daño.', 'Controlla ogni stanza e fotografa con data eventuali danni.', 'Verifique cada divisão e tire fotos com data de qualquer dano.'] },
    { n: ['Write down defects that are not on the list.', 'Notieren Sie Mängel, die nicht in der Liste stehen.', 'Notez les défauts qui ne figurent pas sur la liste.', 'Anote los desperfectos que no aparecen en la lista.', "Annota i difetti che non sono nell'elenco.", 'Anote os defeitos que não estão na lista.'] },
    { d: ['Return the signed sheet by {date}.', 'Geben Sie das unterschriebene Blatt bis {date} zurück.', 'Renvoyez la feuille signée avant le {date}.', 'Devuelva la hoja firmada antes del {date}.', 'Restituisci il foglio firmato entro il {date}.', 'Devolva a folha assinada até {date}.'],
      n: ['Return the signed sheet in time.', 'Geben Sie das unterschriebene Blatt rechtzeitig zurück.', 'Renvoyez la feuille signée à temps.', 'Devuelva la hoja firmada a tiempo.', 'Restituisci il foglio firmato in tempo.', 'Devolva a folha assinada a tempo.'] },
    KEEP,
  ],
  unknown: [
    { n: ['Find out who sent it and why.', 'Finden Sie heraus, wer es geschickt hat und warum.', "Identifiez qui l'a envoyé et pourquoi.", 'Averigüe quién lo envió y por qué.', "Scopri chi l'ha inviato e perché.", 'Descubra quem o enviou e porquê.'] },
    { n: ['Ask the sender or someone you trust what you need to do.', 'Fragen Sie den Absender oder eine Vertrauensperson, was zu tun ist.', "Demandez à l'expéditeur ou à une personne de confiance ce que vous devez faire.", 'Pregunte al remitente o a alguien de confianza qué debe hacer.', 'Chiedi al mittente o a una persona di fiducia cosa devi fare.', 'Pergunte ao remetente ou a alguém de confiança o que tem de fazer.'] },
    KEEP,
  ],
};

const IDX = Object.fromEntries(LANGS.map((l, i) => [l, i])) as Record<Lang, number>;

/** Steps for this card in the card language. */
export function stepsFor(card: ActionCard): string[] {
  const L = card.userLanguage;
  const type = card.docType.value ?? 'unknown';
  const date = card.deadline.value ? formatDate(card.deadline.value, L) : null;
  return STEPS[type].map((s) => (date && s.d ? s.d[IDX[L]].split('{date}').join(date) : s.n[IDX[L]]));
}
/** Toggle a tick; returns the new card. */
export function toggleStep(card: ActionCard, i: number): ActionCard {
  const done = new Set(card.stepsDone ?? []);
  if (done.has(i)) done.delete(i); else done.add(i);
  return { ...card, stepsDone: [...done].sort((a, b) => a - b) };
}
export const STEP_TEMPLATES = STEPS;
