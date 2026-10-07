import type { DocType, Lang } from './types';

type T = Record<Lang, string>;

export const DOC_TYPE_LABEL: Record<DocType, T> = {
  parking_fine: { en: 'Parking / traffic fine', de: 'Park- / Bußgeldbescheid', fr: 'Amende de stationnement / circulation', es: 'Multa de aparcamiento / tráfico', it: 'Multa per sosta / traffico', pt: 'Multa de estacionamento / trânsito' },
  medicine_label: { en: 'Medicine label', de: 'Arzneimittel-Etikett', fr: 'Étiquette de médicament', es: 'Etiqueta de medicamento', it: 'Etichetta di farmaco', pt: 'Rótulo de medicamento' },
  airline_cancellation: { en: 'Airline cancellation', de: 'Flugannullierung', fr: 'Annulation de vol', es: 'Cancelación de vuelo', it: 'Cancellazione volo', pt: 'Cancelamento de voo' },
  hotel_cancellation: { en: 'Hotel booking / cancellation rules', de: 'Hotelbuchung / Stornobedingungen', fr: "Réservation d'hôtel / conditions d'annulation", es: 'Reserva de hotel / condiciones de cancelación', it: 'Prenotazione hotel / condizioni di cancellazione', pt: 'Reserva de hotel / condições de cancelamento' },
  visa_entry: { en: 'Visa / entry / residence letter', de: 'Visum / Einreise / Aufenthalt', fr: 'Visa / entrée / titre de séjour', es: 'Visado / entrada / residencia', it: 'Visto / ingresso / soggiorno', pt: 'Visto / entrada / residência' },
  rental_move_in: { en: 'Rental move-in sheet', de: 'Wohnungsübergabe / Mietprotokoll', fr: 'État des lieux / location', es: 'Hoja de entrada / alquiler', it: 'Verbale di consegna / affitto', pt: 'Auto de entrega / arrendamento' },
  unknown: { en: 'Unknown document type', de: 'Unbekannter Dokumenttyp', fr: 'Type de document inconnu', es: 'Tipo de documento desconocido', it: 'Tipo di documento sconosciuto', pt: 'Tipo de documento desconhecido' },
};

export const DISCLAIMER: T = {
  en: 'This card can be wrong. Check the original document. Not legal or medical advice.',
  de: 'Diese Karte kann falsch sein. Prüfen Sie das Originaldokument. Keine Rechts- oder medizinische Beratung.',
  fr: "Cette fiche peut se tromper. Vérifiez le document original. Ce n'est pas un conseil juridique ou médical.",
  es: 'Esta tarjeta puede equivocarse. Compruebe el documento original. No es asesoramiento legal ni médico.',
  it: 'Questa scheda può sbagliare. Controlla il documento originale. Non è una consulenza legale o medica.',
  pt: 'Este cartão pode estar errado. Confira o documento original. Não é aconselhamento jurídico ou médico.',
};

const THE_AMOUNT: T = { en: 'the amount', de: 'den Betrag', fr: 'le montant', es: 'el importe', it: "l'importo", pt: 'o valor' };

/** Next action, with a date ({date}) and without. {amount} is always filled (number or generic word). */
const NEXT: Record<DocType, { withDate: T; noDate: T }> = {
  parking_fine: {
    withDate: {
      en: 'Pay {amount} by {date} (quote the reference), or contest it in writing before then if you think it is wrong.',
      de: 'Zahlen Sie {amount} bis {date} (mit Aktenzeichen) oder legen Sie vorher schriftlich Widerspruch ein, wenn Sie ihn für falsch halten.',
      fr: "Payez {amount} avant le {date} (en indiquant la référence), ou contestez par écrit avant cette date si vous pensez que c'est une erreur.",
      es: 'Pague {amount} antes del {date} (indicando la referencia) o recúrrala por escrito antes de esa fecha si cree que es un error.',
      it: "Paga {amount} entro il {date} (indicando il riferimento) oppure contesta per iscritto prima di tale data se pensi che sia un errore.",
      pt: 'Pague {amount} até {date} (indicando a referência) ou conteste por escrito antes dessa data se achar que está errado.',
    },
    noDate: {
      en: 'Find the payment deadline on the original (not detected), then pay {amount} or contest it in writing before it.',
      de: 'Suchen Sie die Zahlungsfrist im Original (nicht erkannt) und zahlen Sie {amount} oder legen Sie vorher Widerspruch ein.',
      fr: "Cherchez la date limite sur l'original (non détectée), puis payez {amount} ou contestez par écrit avant.",
      es: 'Busque el plazo de pago en el original (no detectado) y pague {amount} o recurra por escrito antes.',
      it: "Cerca la scadenza di pagamento sull'originale (non rilevata), poi paga {amount} o contesta per iscritto prima.",
      pt: 'Procure o prazo de pagamento no original (não detetado) e pague {amount} ou conteste por escrito antes.',
    },
  },
  medicine_label: {
    withDate: {
      en: 'Before taking it, show this label to a pharmacist and confirm it is right for you. Do not use after {date}.',
      de: 'Zeigen Sie dieses Etikett vor der Einnahme in einer Apotheke und lassen Sie sich bestätigen, dass es für Sie geeignet ist. Nicht nach dem {date} verwenden.',
      fr: "Avant de le prendre, montrez cette étiquette à un pharmacien et faites confirmer qu'il vous convient. Ne pas utiliser après le {date}.",
      es: 'Antes de tomarlo, enseñe esta etiqueta a un farmacéutico y confirme que es adecuado para usted. No usar después del {date}.',
      it: 'Prima di assumerlo, mostra questa etichetta a un farmacista e fatti confermare che è adatto a te. Non usare dopo il {date}.',
      pt: 'Antes de tomar, mostre este rótulo a um farmacêutico e confirme que é adequado para si. Não usar depois de {date}.',
    },
    noDate: {
      en: 'Before taking it, show this label to a pharmacist and confirm it is right for you and how to take it.',
      de: 'Zeigen Sie dieses Etikett vor der Einnahme in einer Apotheke und lassen Sie sich Eignung und Einnahme bestätigen.',
      fr: "Avant de le prendre, montrez cette étiquette à un pharmacien et faites confirmer qu'il vous convient et comment le prendre.",
      es: 'Antes de tomarlo, enseñe esta etiqueta a un farmacéutico y confirme que es adecuado para usted y cómo tomarlo.',
      it: 'Prima di assumerlo, mostra questa etichetta a un farmacista e fatti confermare che è adatto a te e come assumerlo.',
      pt: 'Antes de tomar, mostre este rótulo a um farmacêutico e confirme que é adequado para si e como tomar.',
    },
  },
  airline_cancellation: {
    withDate: {
      en: 'Choose a refund ({amount}) or rebooking and submit your request by {date}. Keep a copy of this notice.',
      de: 'Wählen Sie Erstattung ({amount}) oder Umbuchung und stellen Sie den Antrag bis {date}. Bewahren Sie diese Mitteilung auf.',
      fr: "Choisissez remboursement ({amount}) ou réacheminement et envoyez votre demande avant le {date}. Gardez une copie de cet avis.",
      es: 'Elija reembolso ({amount}) o cambio de vuelo y envíe su solicitud antes del {date}. Guarde una copia de este aviso.',
      it: 'Scegli rimborso ({amount}) o riprotezione e invia la richiesta entro il {date}. Conserva una copia di questo avviso.',
      pt: 'Escolha reembolso ({amount}) ou remarcação e envie o pedido até {date}. Guarde uma cópia deste aviso.',
    },
    noDate: {
      en: 'Choose a refund ({amount}) or rebooking and submit your request as soon as possible. Keep a copy of this notice.',
      de: 'Wählen Sie Erstattung ({amount}) oder Umbuchung und stellen Sie den Antrag so bald wie möglich. Bewahren Sie diese Mitteilung auf.',
      fr: 'Choisissez remboursement ({amount}) ou réacheminement et envoyez votre demande au plus vite. Gardez une copie de cet avis.',
      es: 'Elija reembolso ({amount}) o cambio de vuelo y envíe su solicitud cuanto antes. Guarde una copia de este aviso.',
      it: 'Scegli rimborso ({amount}) o riprotezione e invia la richiesta il prima possibile. Conserva una copia di questo avviso.',
      pt: 'Escolha reembolso ({amount}) ou remarcação e envie o pedido o mais rápido possível. Guarde uma cópia deste aviso.',
    },
  },
  hotel_cancellation: {
    withDate: {
      en: 'If you might not go, cancel in writing before {date} to avoid paying {amount}. Ask for written confirmation.',
      de: 'Falls Sie eventuell nicht anreisen, stornieren Sie schriftlich vor dem {date}, um {amount} zu vermeiden. Bitten Sie um schriftliche Bestätigung.',
      fr: "Si vous risquez de ne pas venir, annulez par écrit avant le {date} pour éviter de payer {amount}. Demandez une confirmation écrite.",
      es: 'Si puede que no vaya, cancele por escrito antes del {date} para no pagar {amount}. Pida confirmación por escrito.',
      it: 'Se potresti non andare, cancella per iscritto entro il {date} per evitare di pagare {amount}. Chiedi una conferma scritta.',
      pt: 'Se talvez não for, cancele por escrito antes de {date} para evitar pagar {amount}. Peça confirmação por escrito.',
    },
    noDate: {
      en: 'Find the free-cancellation deadline on the original (not detected). Cancel in writing before it to avoid paying {amount}.',
      de: 'Suchen Sie die Frist für kostenlose Stornierung im Original (nicht erkannt) und stornieren Sie vorher schriftlich, um {amount} zu vermeiden.',
      fr: "Cherchez la date limite d'annulation gratuite sur l'original (non détectée) et annulez par écrit avant pour éviter {amount}.",
      es: 'Busque en el original el plazo de cancelación gratuita (no detectado) y cancele por escrito antes para no pagar {amount}.',
      it: "Cerca sull'originale la scadenza per la cancellazione gratuita (non rilevata) e cancella per iscritto prima per evitare {amount}.",
      pt: 'Procure no original o prazo de cancelamento gratuito (não detetado) e cancele por escrito antes para evitar {amount}.',
    },
  },
  visa_entry: {
    withDate: {
      en: 'Send the requested documents / payment ({amount}) before {date} and keep proof that you sent them.',
      de: 'Senden Sie die angeforderten Unterlagen / Zahlung ({amount}) vor dem {date} und bewahren Sie einen Nachweis auf.',
      fr: "Envoyez les pièces / le paiement demandés ({amount}) avant le {date} et gardez une preuve d'envoi.",
      es: 'Envíe los documentos / el pago solicitados ({amount}) antes del {date} y guarde el justificante de envío.',
      it: "Invia i documenti / il pagamento richiesti ({amount}) entro il {date} e conserva la prova dell'invio.",
      pt: 'Envie os documentos / o pagamento pedidos ({amount}) até {date} e guarde o comprovativo de envio.',
    },
    noDate: {
      en: 'Find what is requested and by when on the original (deadline not detected). Reply in writing and keep proof.',
      de: 'Prüfen Sie im Original, was bis wann verlangt wird (Frist nicht erkannt). Antworten Sie schriftlich und bewahren Sie einen Nachweis auf.',
      fr: "Vérifiez sur l'original ce qui est demandé et pour quand (date non détectée). Répondez par écrit et gardez une preuve.",
      es: 'Compruebe en el original qué se pide y para cuándo (plazo no detectado). Responda por escrito y guarde justificante.',
      it: "Verifica sull'originale cosa viene richiesto ed entro quando (scadenza non rilevata). Rispondi per iscritto e conserva la prova.",
      pt: 'Verifique no original o que é pedido e até quando (prazo não detetado). Responda por escrito e guarde comprovativo.',
    },
  },
  rental_move_in: {
    withDate: {
      en: 'Photograph every room now, note all existing damage on the sheet and return it signed before {date}. Your deposit ({amount}) depends on it.',
      de: 'Fotografieren Sie jetzt alle Räume, notieren Sie alle Schäden im Protokoll und geben Sie es vor dem {date} unterschrieben zurück. Ihre Kaution ({amount}) hängt davon ab.',
      fr: "Photographiez chaque pièce maintenant, notez tous les défauts sur la fiche et rendez-la signée avant le {date}. Votre dépôt ({amount}) en dépend.",
      es: 'Fotografíe ahora cada habitación, anote todos los desperfectos en la hoja y devuélvala firmada antes del {date}. Su fianza ({amount}) depende de ello.',
      it: 'Fotografa ora ogni stanza, annota tutti i danni sul verbale e restituiscilo firmato entro il {date}. Il tuo deposito ({amount}) dipende da questo.',
      pt: 'Fotografe agora cada divisão, anote todos os danos na folha e devolva-a assinada até {date}. A sua caução ({amount}) depende disso.',
    },
    noDate: {
      en: 'Photograph every room now, note all existing damage on the sheet and return it signed quickly (deadline not detected). Your deposit ({amount}) depends on it.',
      de: 'Fotografieren Sie jetzt alle Räume, notieren Sie alle Schäden und geben Sie das Protokoll zügig unterschrieben zurück (Frist nicht erkannt). Ihre Kaution ({amount}) hängt davon ab.',
      fr: 'Photographiez chaque pièce, notez tous les défauts et rendez la fiche signée rapidement (date non détectée). Votre dépôt ({amount}) en dépend.',
      es: 'Fotografíe cada habitación, anote todos los desperfectos y devuelva la hoja firmada pronto (plazo no detectado). Su fianza ({amount}) depende de ello.',
      it: 'Fotografa ogni stanza, annota tutti i danni e restituisci il verbale firmato presto (scadenza non rilevata). Il tuo deposito ({amount}) dipende da questo.',
      pt: 'Fotografe cada divisão, anote todos os danos e devolva a folha assinada rapidamente (prazo não detetado). A sua caução ({amount}) depende disso.',
    },
  },
  unknown: {
    withDate: {
      en: 'Document type not recognised. A date was found ({date}); ask someone who reads the language to check what it means.',
      de: 'Dokumenttyp nicht erkannt. Ein Datum wurde gefunden ({date}); lassen Sie es von jemandem prüfen, der die Sprache liest.',
      fr: "Type de document non reconnu. Une date a été trouvée ({date}) ; faites vérifier par quelqu'un qui lit la langue.",
      es: 'Tipo de documento no reconocido. Se encontró una fecha ({date}); pida a alguien que lea el idioma que lo revise.',
      it: 'Tipo di documento non riconosciuto. È stata trovata una data ({date}); fallo controllare da qualcuno che legge la lingua.',
      pt: 'Tipo de documento não reconhecido. Foi encontrada uma data ({date}); peça a alguém que leia a língua para verificar.',
    },
    noDate: {
      en: 'Document type not recognised. Ask someone who reads the language, or the sender, what you need to do and by when.',
      de: 'Dokumenttyp nicht erkannt. Fragen Sie jemanden, der die Sprache liest, oder den Absender, was bis wann zu tun ist.',
      fr: "Type de document non reconnu. Demandez à quelqu'un qui lit la langue, ou à l'expéditeur, quoi faire et pour quand.",
      es: 'Tipo de documento no reconocido. Pregunte a alguien que lea el idioma, o al remitente, qué debe hacer y para cuándo.',
      it: 'Tipo di documento non riconosciuto. Chiedi a qualcuno che legge la lingua, o al mittente, cosa fare ed entro quando.',
      pt: 'Tipo de documento não reconhecido. Pergunte a alguém que leia a língua, ou ao remetente, o que fazer e até quando.',
    },
  },
};

/** Short reply drafts. {refPart} becomes e.g. " (ref. 12345)" or "". */
const REPLY: Record<DocType, T> = {
  parking_fine: {
    en: 'Dear Sir or Madam,\nRegarding the notice{refPart}: I am a visitor and do not fully understand it. Could you please confirm the amount due, the payment deadline and how I can pay from abroad?\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich des Bescheids{refPart}: Ich bin Besucher und verstehe ihn nicht vollständig. Könnten Sie mir bitte den fälligen Betrag, die Zahlungsfrist und die Zahlungsmöglichkeiten aus dem Ausland bestätigen?\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant l'avis{refPart} : je suis de passage et je ne le comprends pas entièrement. Pourriez-vous me confirmer le montant dû, la date limite de paiement et comment payer depuis l'étranger ?\nCordialement",
    es: 'Estimados señores:\nEn relación con la notificación{refPart}: soy visitante y no la entiendo del todo. ¿Podrían confirmarme el importe, el plazo de pago y cómo puedo pagar desde el extranjero?\nAtentamente',
    it: "Gentili Signori,\nin merito al verbale{refPart}: sono un visitatore e non lo comprendo del tutto. Potreste confermarmi l'importo dovuto, la scadenza di pagamento e come pagare dall'estero?\nCordiali saluti",
    pt: 'Exmos. Senhores,\nRelativamente à notificação{refPart}: sou visitante e não a compreendo totalmente. Poderiam confirmar o valor devido, o prazo de pagamento e como posso pagar a partir do estrangeiro?\nCom os melhores cumprimentos',
  },
  medicine_label: {
    en: 'Hello,\nI have this medicine and cannot fully read the label. Could you please confirm whether it is right for me, how I should take it, and whether it is safe with my other medicines?\nThank you',
    de: 'Guten Tag,\nich habe dieses Arzneimittel und kann das Etikett nicht vollständig lesen. Können Sie mir bitte bestätigen, ob es für mich geeignet ist, wie ich es einnehmen soll und ob es mit meinen anderen Medikamenten verträglich ist?\nVielen Dank',
    fr: "Bonjour,\nJ'ai ce médicament et je ne peux pas lire entièrement l'étiquette. Pourriez-vous me confirmer s'il me convient, comment le prendre et s'il est compatible avec mes autres médicaments ?\nMerci",
    es: 'Hola:\nTengo este medicamento y no puedo leer bien la etiqueta. ¿Podría confirmarme si es adecuado para mí, cómo debo tomarlo y si es seguro con mis otros medicamentos?\nGracias',
    it: "Buongiorno,\nho questo farmaco e non riesco a leggere bene l'etichetta. Potrebbe confermarmi se è adatto a me, come devo assumerlo e se è sicuro con gli altri farmaci che prendo?\nGrazie",
    pt: 'Olá,\nTenho este medicamento e não consigo ler bem o rótulo. Pode confirmar se é adequado para mim, como devo tomá-lo e se é seguro com os meus outros medicamentos?\nObrigado',
  },
  airline_cancellation: {
    en: 'Dear Sir or Madam,\nMy flight{refPart} has been cancelled. I request a full refund to my original payment method (or: rebooking on the next available flight). Please confirm in writing.\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nmein Flug{refPart} wurde annulliert. Ich beantrage die vollständige Erstattung auf mein ursprüngliches Zahlungsmittel (oder: Umbuchung auf den nächsten verfügbaren Flug). Bitte bestätigen Sie dies schriftlich.\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nMon vol{refPart} a été annulé. Je demande le remboursement intégral sur mon moyen de paiement initial (ou : un réacheminement sur le prochain vol disponible). Merci de me confirmer par écrit.\nCordialement",
    es: 'Estimados señores:\nMi vuelo{refPart} ha sido cancelado. Solicito el reembolso completo en mi método de pago original (o: un cambio al siguiente vuelo disponible). Por favor, confírmenlo por escrito.\nAtentamente',
    it: 'Gentili Signori,\nil mio volo{refPart} è stato cancellato. Chiedo il rimborso completo sul metodo di pagamento originale (oppure: la riprotezione sul primo volo disponibile). Vi prego di confermare per iscritto.\nCordiali saluti',
    pt: 'Exmos. Senhores,\nO meu voo{refPart} foi cancelado. Solicito o reembolso total no meio de pagamento original (ou: a remarcação no próximo voo disponível). Agradeço confirmação por escrito.\nCom os melhores cumprimentos',
  },
  hotel_cancellation: {
    en: 'Dear Sir or Madam,\nI would like to cancel my reservation{refPart} free of charge, within the free cancellation period. Please confirm the cancellation in writing.\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nich möchte meine Reservierung{refPart} innerhalb der kostenlosen Stornierungsfrist stornieren. Bitte bestätigen Sie die Stornierung schriftlich.\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nJe souhaite annuler sans frais ma réservation{refPart}, dans le délai d'annulation gratuite. Merci de me confirmer l'annulation par écrit.\nCordialement",
    es: 'Estimados señores:\nDeseo cancelar sin coste mi reserva{refPart}, dentro del plazo de cancelación gratuita. Les ruego que me confirmen la cancelación por escrito.\nAtentamente',
    it: 'Gentili Signori,\ndesidero cancellare senza penali la mia prenotazione{refPart}, entro il termine di cancellazione gratuita. Vi prego di confermare la cancellazione per iscritto.\nCordiali saluti',
    pt: 'Exmos. Senhores,\nGostaria de cancelar sem custos a minha reserva{refPart}, dentro do prazo de cancelamento gratuito. Agradeço confirmação do cancelamento por escrito.\nCom os melhores cumprimentos',
  },
  visa_entry: {
    en: 'Dear Sir or Madam,\nRegarding my application{refPart}: I have received your letter. Could you please confirm exactly which documents are still required and how I should send them?\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich meines Antrags{refPart}: Ich habe Ihr Schreiben erhalten. Könnten Sie mir bitte genau bestätigen, welche Unterlagen noch fehlen und wie ich sie einreichen soll?\nMit freundlichen Grüßen',
    fr: 'Madame, Monsieur,\nConcernant ma demande{refPart} : j\'ai bien reçu votre courrier. Pourriez-vous me confirmer précisément les pièces encore requises et comment les transmettre ?\nCordialement',
    es: 'Estimados señores:\nEn relación con mi solicitud{refPart}: he recibido su carta. ¿Podrían confirmarme exactamente qué documentos faltan y cómo debo enviarlos?\nAtentamente',
    it: 'Gentili Signori,\nin merito alla mia domanda{refPart}: ho ricevuto la vostra lettera. Potreste confermarmi esattamente quali documenti mancano e come devo inviarli?\nCordiali saluti',
    pt: 'Exmos. Senhores,\nRelativamente ao meu pedido{refPart}: recebi a vossa carta. Poderiam confirmar exatamente que documentos ainda faltam e como os devo enviar?\nCom os melhores cumprimentos',
  },
  rental_move_in: {
    en: 'Dear Sir or Madam,\nRegarding the rental{refPart}: I have received the move-in sheet. I will return it signed and list any existing damage, with photos, before the deadline. Please confirm receipt.\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich des Mietverhältnisses{refPart}: Ich habe das Übergabeprotokoll erhalten. Ich sende es fristgerecht unterschrieben zurück und liste vorhandene Schäden mit Fotos auf. Bitte bestätigen Sie den Eingang.\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant la location{refPart} : j'ai bien reçu l'état des lieux. Je le renverrai signé avant la date limite, avec la liste et les photos des défauts existants. Merci de confirmer la réception.\nCordialement",
    es: 'Estimados señores:\nEn relación con el alquiler{refPart}: he recibido la hoja de entrada. La devolveré firmada antes del plazo, indicando los desperfectos existentes con fotos. Por favor, confirmen la recepción.\nAtentamente',
    it: "Gentili Signori,\nin merito alla locazione{refPart}: ho ricevuto il verbale di consegna. Lo restituirò firmato entro il termine, indicando i danni esistenti con foto. Vi prego di confermare la ricezione.\nCordiali saluti",
    pt: 'Exmos. Senhores,\nRelativamente ao arrendamento{refPart}: recebi o auto de entrega. Devolvê-lo-ei assinado dentro do prazo, indicando os danos existentes com fotografias. Agradeço confirmação da receção.\nCom os melhores cumprimentos',
  },
  unknown: {
    en: 'Hello,\nI received this document but cannot fully read it. Could you please tell me what I need to do and by when?\nThank you',
    de: 'Guten Tag,\nich habe dieses Dokument erhalten, kann es aber nicht vollständig lesen. Könnten Sie mir bitte sagen, was ich bis wann tun muss?\nVielen Dank',
    fr: "Bonjour,\nJ'ai reçu ce document mais je ne peux pas le lire entièrement. Pourriez-vous me dire ce que je dois faire et pour quand ?\nMerci",
    es: 'Hola:\nHe recibido este documento pero no puedo leerlo del todo. ¿Podrían decirme qué debo hacer y para cuándo?\nGracias',
    it: 'Buongiorno,\nho ricevuto questo documento ma non riesco a leggerlo del tutto. Potreste dirmi cosa devo fare ed entro quando?\nGrazie',
    pt: 'Olá,\nRecebi este documento mas não consigo lê-lo totalmente. Poderiam dizer-me o que devo fazer e até quando?\nObrigado',
  },
};

const REF_WORD: T = { en: 'ref.', de: 'Az.', fr: 'réf.', es: 'ref.', it: 'rif.', pt: 'ref.' };
const LOCALE: T = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };

export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function formatMoney(amount: number, currency: string, lang: Lang): string {
  try {
    return new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function nextActionText(type: DocType, lang: Lang, deadline: string | null, amount: { amount: number; currency: string } | null): string {
  const t = NEXT[type][deadline ? 'withDate' : 'noDate'][lang];
  return (amount ? t : t.replace(/\s?\(\{amount\}\)/g, ''))
    .replace('{date}', deadline ? formatDate(deadline, lang) : '')
    .replace('{amount}', amount ? formatMoney(amount.amount, amount.currency, lang) : THE_AMOUNT[lang])
    .replace(/\s\(\s*\)/g, '');
}

export function replyText(type: DocType, lang: Lang, ref: string | null): string {
  return REPLY[type][lang].replace('{refPart}', ref ? ` (${REF_WORD[lang]} ${ref})` : '');
}

/** Appended when the document only gives a relative deadline whose start date is not printed. */
export const REL_UNKNOWN: T = {
  en: 'The document gives a relative deadline: “{rule}”. Its start date is not printed, so work out the date from when you received it.',
  de: 'Das Dokument nennt eine relative Frist: „{rule}“. Das Startdatum steht nicht darauf; rechnen Sie ab dem Tag, an dem Sie es erhalten haben.',
  fr: "Le document indique un délai relatif : « {rule} ». La date de départ n'est pas imprimée ; comptez à partir du jour où vous l'avez reçu.",
  es: 'El documento indica un plazo relativo: «{rule}». La fecha de inicio no aparece; cuente desde el día en que lo recibió.',
  it: 'Il documento indica un termine relativo: «{rule}». La data di inizio non è stampata; conta dal giorno in cui lo hai ricevuto.',
  pt: 'O documento indica um prazo relativo: «{rule}». A data de início não está impressa; conte a partir do dia em que o recebeu.',
};
