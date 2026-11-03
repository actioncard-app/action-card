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

  tax_office: [
    { n: ['Check which tax year and which tax the letter is about.', 'Prüfen Sie, um welches Steuerjahr und welche Steuer es geht.', "Vérifiez l'année et l'impôt concernés.", 'Compruebe a qué ejercicio y a qué impuesto se refiere.', "Controlla a quale anno e a quale imposta si riferisce.", 'Verifique a que ano e a que imposto se refere.'] },
    { d: ['Pay or send the requested documents by {date}, quoting the reference.', 'Zahlen Sie oder schicken Sie die Unterlagen bis {date} mit Steuernummer/Aktenzeichen.', 'Payez ou envoyez les pièces demandées avant le {date}, en indiquant la référence.', 'Pague o envíe los documentos antes del {date}, indicando la referencia.', 'Paga o invia i documenti richiesti entro il {date}, indicando il riferimento.', 'Pague ou envie os documentos até {date}, indicando a referência.'],
      n: ['Pay or send the requested documents in time, quoting the reference.', 'Zahlen Sie oder schicken Sie die Unterlagen rechtzeitig mit Steuernummer/Aktenzeichen.', 'Payez ou envoyez les pièces à temps, en indiquant la référence.', 'Pague o envíe los documentos a tiempo, indicando la referencia.', 'Paga o invia i documenti in tempo, indicando il riferimento.', 'Pague ou envie os documentos a tempo, indicando a referência.'] },
    { n: ['If you disagree, object in writing before the deadline (a tax adviser or advice centre can help).', 'Wenn Sie nicht einverstanden sind, legen Sie vor Fristende schriftlich Einspruch ein (Steuerberatung oder Lohnsteuerhilfeverein kann helfen).', "En cas de désaccord, contestez par écrit avant la date limite (un conseiller peut vous aider).", 'Si no está de acuerdo, recurra por escrito antes del plazo (un asesor puede ayudarle).', 'Se non sei d\'accordo, presenta ricorso per iscritto prima della scadenza (un CAF o un commercialista può aiutarti).', 'Se não concordar, reclame por escrito antes do prazo (um contabilista pode ajudar).'] },
    KEEP,
  ],
  health_insurance: [
    { n: ['Check what the insurer is asking for: documents, a form or a payment.', 'Prüfen Sie, was die Kasse will: Unterlagen, ein Formular oder eine Zahlung.', "Vérifiez ce que demande l'assurance : des pièces, un formulaire ou un paiement.", 'Compruebe qué pide el seguro: documentos, un formulario o un pago.', "Controlla cosa chiede l'assicurazione: documenti, un modulo o un pagamento.", 'Verifique o que o seguro pede: documentos, um formulário ou um pagamento.'] },
    { d: ['Reply by {date}, quoting your insurance number.', 'Antworten Sie bis {date} mit Ihrer Versichertennummer.', "Répondez avant le {date} en indiquant votre numéro d'assuré.", 'Responda antes del {date} indicando su número de afiliado.', 'Rispondi entro il {date} indicando il tuo numero di assicurato.', 'Responda até {date}, indicando o seu número de beneficiário.'],
      n: ['Reply in time, quoting your insurance number.', 'Antworten Sie rechtzeitig mit Ihrer Versichertennummer.', "Répondez à temps en indiquant votre numéro d'assuré.", 'Responda a tiempo indicando su número de afiliado.', 'Rispondi in tempo indicando il tuo numero di assicurato.', 'Responda a tempo, indicando o seu número de beneficiário.'] },
    { n: ['Call or write to them if anything is unclear.', 'Rufen Sie an oder schreiben Sie, wenn etwas unklar ist.', "Appelez-les ou écrivez-leur si quelque chose n'est pas clair.", 'Llame o escriba si algo no está claro.', 'Chiama o scrivi se qualcosa non è chiaro.', 'Ligue ou escreva se algo não estiver claro.'] },
    KEEP,
  ],
  debt_collection: [
    { n: ['Check that you know the original creditor and really owe this amount.', 'Prüfen Sie, ob Sie den ursprünglichen Gläubiger kennen und den Betrag wirklich schulden.', 'Vérifiez que vous connaissez le créancier d\'origine et que vous devez vraiment ce montant.', 'Compruebe que conoce al acreedor original y que realmente debe ese importe.', 'Verifica di conoscere il creditore originario e di dovere davvero questo importo.', 'Confirme que conhece o credor original e que deve mesmo esse valor.'] },
    { n: ['Look up the sender yourself (not via the letter\'s links or numbers).', 'Suchen Sie den Absender selbst heraus (nicht über Links oder Nummern im Brief).', "Recherchez l'expéditeur vous-même (pas via les liens ou numéros de la lettre).", 'Busque usted mismo al remitente (no mediante los enlaces o teléfonos de la carta).', 'Cerca tu stesso il mittente (non tramite link o numeri della lettera).', 'Procure o remetente por si (não pelos links ou números da carta).'] },
    { d: ['If correct, pay by {date}; if not, dispute it in writing before then.', 'Wenn es stimmt, zahlen Sie bis {date}; wenn nicht, widersprechen Sie vorher schriftlich.', "Si c'est correct, payez avant le {date} ; sinon, contestez par écrit avant.", 'Si es correcto, pague antes del {date}; si no, oponga su desacuerdo por escrito antes.', 'Se è corretto, paga entro il {date}; altrimenti contesta per iscritto prima.', 'Se estiver certo, pague até {date}; se não, conteste por escrito antes.'],
      n: ['If correct, pay in time; if not, dispute it in writing.', 'Wenn es stimmt, zahlen Sie rechtzeitig; wenn nicht, widersprechen Sie schriftlich.', "Si c'est correct, payez à temps ; sinon, contestez par écrit.", 'Si es correcto, pague a tiempo; si no, oponga su desacuerdo por escrito.', 'Se è corretto, paga in tempo; altrimenti contesta per iscritto.', 'Se estiver certo, pague a tempo; se não, conteste por escrito.'] },
    KEEP,
  ],
  utility_bill: [
    { n: ['Check the billing period, meter readings and your customer number.', 'Prüfen Sie Abrechnungszeitraum, Zählerstände und Kundennummer.', 'Vérifiez la période, les relevés et votre numéro client.', 'Compruebe el periodo, las lecturas y su número de cliente.', 'Controlla periodo, letture e codice cliente.', 'Verifique o período, as leituras e o seu número de cliente.'] },
    { d: ['Pay by {date} (or check that the direct debit will go through).', 'Zahlen Sie bis {date} (oder prüfen Sie, ob die Lastschrift gedeckt ist).', 'Payez avant le {date} (ou vérifiez que le prélèvement passera).', 'Pague antes del {date} (o compruebe que la domiciliación tiene saldo).', "Paga entro il {date} (o verifica che l'addebito vada a buon fine).", 'Pague até {date} (ou confirme que o débito direto tem saldo).'],
      n: ['Pay by the due date (or check that the direct debit will go through).', 'Zahlen Sie bis zur Fälligkeit (oder prüfen Sie, ob die Lastschrift gedeckt ist).', "Payez avant l'échéance (ou vérifiez que le prélèvement passera).", 'Pague antes del vencimiento (o compruebe que la domiciliación tiene saldo).', "Paga entro la scadenza (o verifica che l'addebito vada a buon fine).", 'Pague até à data-limite (ou confirme que o débito direto tem saldo).'] },
    { n: ['If the amount looks wrong, contact the supplier before paying late.', 'Wenn der Betrag falsch aussieht, melden Sie sich beim Anbieter, bevor Sie zu spät zahlen.', 'Si le montant semble faux, contactez le fournisseur avant de payer en retard.', 'Si el importe parece erróneo, contacte con la compañía antes de pagar tarde.', 'Se l\'importo sembra sbagliato, contatta il fornitore prima di pagare in ritardo.', 'Se o valor parecer errado, contacte o fornecedor antes de pagar atrasado.'] },
    KEEP,
  ],
  benefits_office: [
    { n: ['Make a list of the documents or information they ask for.', 'Notieren Sie, welche Unterlagen oder Angaben verlangt werden.', 'Faites la liste des pièces ou informations demandées.', 'Haga una lista de los documentos o datos que piden.', 'Fai un elenco dei documenti o delle informazioni richieste.', 'Faça uma lista dos documentos ou informações pedidos.'] },
    { d: ['Send them (or go to the appointment) by {date}, quoting your reference.', 'Schicken Sie sie (oder gehen Sie zum Termin) bis {date} und nennen Sie Ihr Aktenzeichen.', 'Envoyez-les (ou allez au rendez-vous) avant le {date}, en indiquant votre référence.', 'Envíelos (o acuda a la cita) antes del {date}, indicando su referencia.', "Inviali (o vai all'appuntamento) entro il {date}, indicando il tuo riferimento.", 'Envie-os (ou vá à marcação) até {date}, indicando a sua referência.'],
      n: ['Send them in time, quoting your reference.', 'Schicken Sie sie rechtzeitig und nennen Sie Ihr Aktenzeichen.', 'Envoyez-les à temps, en indiquant votre référence.', 'Envíelos a tiempo, indicando su referencia.', 'Inviali in tempo, indicando il tuo riferimento.', 'Envie-os a tempo, indicando a sua referência.'] },
    { n: ['If you cannot make it in time, ask for an extension in writing.', 'Wenn Sie es nicht rechtzeitig schaffen, bitten Sie schriftlich um Fristverlängerung.', 'Si vous ne pouvez pas respecter le délai, demandez un délai par écrit.', 'Si no llega a tiempo, pida una prórroga por escrito.', 'Se non ce la fai in tempo, chiedi una proroga per iscritto.', 'Se não conseguir a tempo, peça uma prorrogação por escrito.'] },
    KEEP,
  ],
  broadcast_fee: [
    { n: ['Check whether someone at your address already pays this fee.', 'Prüfen Sie, ob in Ihrer Wohnung schon jemand den Beitrag zahlt.', "Vérifiez si quelqu'un paie déjà cette redevance à votre adresse.", 'Compruebe si alguien ya paga esta tasa en su dirección.', 'Verifica se qualcuno paga già il canone al tuo indirizzo.', 'Verifique se alguém já paga esta contribuição na sua morada.'] },
    { d: ['Pay by {date}, or report that you are exempt or already paying.', 'Zahlen Sie bis {date} oder melden Sie, dass Sie befreit sind oder schon zahlen.', 'Payez avant le {date}, ou signalez une exonération ou un paiement existant.', 'Pague antes del {date} o comunique que está exento o ya paga.', 'Paga entro il {date} o comunica che sei esente o paghi già.', 'Pague até {date} ou comunique que está isento ou já paga.'],
      n: ['Pay, or report that you are exempt or already paying.', 'Zahlen Sie oder melden Sie, dass Sie befreit sind oder schon zahlen.', 'Payez, ou signalez une exonération ou un paiement existant.', 'Pague o comunique que está exento o ya paga.', 'Paga o comunica che sei esente o paghi già.', 'Pague ou comunique que está isento ou já paga.'] },
    { n: ['If you receive benefits or a student grant, ask about an exemption.', 'Wenn Sie Sozialleistungen oder BAföG bekommen, fragen Sie nach einer Befreiung.', 'Si vous touchez des aides sociales, renseignez-vous sur une exonération.', 'Si recibe prestaciones, pregunte por una exención.', 'Se ricevi sussidi, informati su una possibile esenzione.', 'Se recebe prestações sociais, pergunte por uma isenção.'] },
    KEEP,
  ],
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
