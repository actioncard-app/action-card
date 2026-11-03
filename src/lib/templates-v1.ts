// Templates for the v1 document types (tax office, health insurance, debt collection, utility bill, benefits office,
// broadcast fee). Same style and register as templates.ts: German "Sie", French/Spanish "vous"/"usted", Italian "tu",
// Portuguese neutral. Kept separate so the original file stays readable; merged into the maps in templates.ts.
import type { Lang } from './types';
type T = Record<Lang, string>;
export type V1Type = 'tax_office' | 'health_insurance' | 'debt_collection' | 'utility_bill' | 'benefits_office' | 'broadcast_fee';

export const V1_LABEL: Record<V1Type, T> = {
  tax_office: { en: 'Tax office letter', de: 'Schreiben vom Finanzamt', fr: 'Courrier des impôts', es: 'Carta de Hacienda', it: "Lettera dell'Agenzia delle Entrate", pt: 'Carta das Finanças' },
  health_insurance: { en: 'Health insurance letter', de: 'Schreiben der Krankenkasse', fr: "Courrier de l'assurance maladie", es: 'Carta del seguro médico', it: "Lettera dell'assicurazione sanitaria", pt: 'Carta do seguro de saúde' },
  debt_collection: { en: 'Payment reminder / debt collection', de: 'Mahnung / Inkasso', fr: 'Relance / recouvrement', es: 'Requerimiento de pago / recobro', it: 'Sollecito / recupero crediti', pt: 'Aviso de cobrança / recuperação de dívida' },
  utility_bill: { en: 'Utility bill (power, gas, water, phone)', de: 'Rechnung Strom / Gas / Wasser / Telefon', fr: 'Facture (électricité, gaz, eau, téléphone)', es: 'Factura (luz, gas, agua, teléfono)', it: 'Bolletta (luce, gas, acqua, telefono)', pt: 'Fatura (luz, gás, água, telefone)' },
  benefits_office: { en: 'Benefits / job centre letter', de: 'Schreiben vom Jobcenter / Sozialamt', fr: 'Courrier CAF / France Travail', es: 'Carta del SEPE / Seguridad Social', it: "Lettera dell'INPS / centro per l'impiego", pt: 'Carta da Segurança Social / IEFP' },
  broadcast_fee: { en: 'TV / broadcast licence fee', de: 'Rundfunkbeitrag', fr: 'Redevance audiovisuelle', es: 'Tasa de radiotelevisión', it: 'Canone TV', pt: 'Contribuição audiovisual' },
};

export const V1_NEXT: Record<V1Type, { withDate: T; noDate: T }> = {
  tax_office: {
    withDate: {
      en: 'Do what the tax office asks by {date}: pay {amount} or send the requested documents. If you think the decision is wrong, you can object in writing before then.',
      de: 'Erledigen Sie bis {date}, was das Finanzamt verlangt: {amount} zahlen oder die angeforderten Unterlagen schicken. Wenn Sie den Bescheid für falsch halten, können Sie vorher schriftlich Einspruch einlegen.',
      fr: "Faites ce que demandent les impôts avant le {date} : payer {amount} ou envoyer les pièces demandées. Si vous pensez que c'est une erreur, vous pouvez contester par écrit avant cette date.",
      es: 'Haga lo que pide Hacienda antes del {date}: pagar {amount} o enviar los documentos solicitados. Si cree que es un error, puede recurrir por escrito antes de esa fecha.',
      it: "Fai ciò che chiede l'Agenzia entro il {date}: pagare {amount} o inviare i documenti richiesti. Se pensi che sia un errore, puoi presentare ricorso per iscritto prima di tale data.",
      pt: 'Faça o que as Finanças pedem até {date}: pagar {amount} ou enviar os documentos pedidos. Se achar que está errado, pode reclamar por escrito antes dessa data.',
    },
    noDate: {
      en: 'Find the deadline on the original (not detected), then pay {amount} or send the requested documents to the tax office in time.',
      de: 'Suchen Sie die Frist im Original (nicht erkannt) und zahlen Sie dann {amount} oder schicken Sie die angeforderten Unterlagen rechtzeitig ans Finanzamt.',
      fr: "Cherchez la date limite sur l'original (non détectée), puis payez {amount} ou envoyez les pièces demandées à temps.",
      es: 'Busque el plazo en el original (no detectado) y pague {amount} o envíe a tiempo los documentos solicitados.',
      it: "Cerca la scadenza sull'originale (non rilevata), poi paga {amount} o invia in tempo i documenti richiesti.",
      pt: 'Procure o prazo no original (não detetado) e pague {amount} ou envie a tempo os documentos pedidos.',
    },
  },
  health_insurance: {
    withDate: {
      en: 'Reply to your health insurer by {date}: send what they ask for or pay {amount}. Ask them if anything is unclear; your cover may depend on it.',
      de: 'Antworten Sie Ihrer Krankenkasse bis {date}: Schicken Sie die angeforderten Angaben oder zahlen Sie {amount}. Fragen Sie nach, wenn etwas unklar ist; Ihr Versicherungsschutz kann davon abhängen.',
      fr: "Répondez à votre assurance maladie avant le {date} : envoyez ce qu'elle demande ou payez {amount}. Demandez-lui si quelque chose n'est pas clair ; votre couverture peut en dépendre.",
      es: 'Responda a su seguro médico antes del {date}: envíe lo que piden o pague {amount}. Pregunte si algo no está claro; su cobertura puede depender de ello.',
      it: "Rispondi alla tua assicurazione sanitaria entro il {date}: invia ciò che chiede o paga {amount}. Chiedi se qualcosa non è chiaro; la tua copertura può dipenderne.",
      pt: 'Responda ao seu seguro de saúde até {date}: envie o que pedem ou pague {amount}. Pergunte se algo não estiver claro; a sua cobertura pode depender disso.',
    },
    noDate: {
      en: 'Find the deadline on the original (not detected) and reply to your health insurer in time: send what they ask for or pay {amount}.',
      de: 'Suchen Sie die Frist im Original (nicht erkannt) und antworten Sie Ihrer Krankenkasse rechtzeitig: Angaben schicken oder {amount} zahlen.',
      fr: "Cherchez la date limite sur l'original (non détectée) et répondez à temps à votre assurance maladie : envoyez ce qu'elle demande ou payez {amount}.",
      es: 'Busque el plazo en el original (no detectado) y responda a tiempo a su seguro médico: envíe lo que piden o pague {amount}.',
      it: "Cerca la scadenza sull'originale (non rilevata) e rispondi in tempo all'assicurazione: invia ciò che chiede o paga {amount}.",
      pt: 'Procure o prazo no original (não detetado) e responda a tempo ao seu seguro de saúde: envie o que pedem ou pague {amount}.',
    },
  },
  debt_collection: {
    withDate: {
      en: 'Before paying, check that you really owe this and who is asking. If it is correct, pay {amount} by {date} to the account in the letter; if not, dispute it in writing before then.',
      de: 'Prüfen Sie vor dem Zahlen, ob Sie das wirklich schulden und wer es fordert. Wenn es stimmt, zahlen Sie {amount} bis {date} auf das Konto im Brief; wenn nicht, widersprechen Sie vorher schriftlich.',
      fr: "Avant de payer, vérifiez que vous devez vraiment cette somme et qui la réclame. Si c'est correct, payez {amount} avant le {date} sur le compte indiqué ; sinon, contestez par écrit avant cette date.",
      es: 'Antes de pagar, compruebe que realmente lo debe y quién lo reclama. Si es correcto, pague {amount} antes del {date} en la cuenta de la carta; si no, oponga su desacuerdo por escrito antes.',
      it: 'Prima di pagare, verifica di dovere davvero questa somma e chi la chiede. Se è corretto, paga {amount} entro il {date} sul conto indicato; altrimenti contesta per iscritto prima di tale data.',
      pt: 'Antes de pagar, confirme que deve mesmo este valor e quem o pede. Se estiver certo, pague {amount} até {date} na conta indicada; se não, conteste por escrito antes dessa data.',
    },
    noDate: {
      en: 'Before paying, check that you really owe this and who is asking. Find the deadline on the original (not detected); pay {amount} or dispute it in writing in time.',
      de: 'Prüfen Sie vor dem Zahlen, ob Sie das wirklich schulden und wer es fordert. Suchen Sie die Frist im Original (nicht erkannt); zahlen Sie {amount} oder widersprechen Sie rechtzeitig schriftlich.',
      fr: "Avant de payer, vérifiez que vous devez vraiment cette somme et qui la réclame. Cherchez la date limite sur l'original (non détectée) ; payez {amount} ou contestez par écrit à temps.",
      es: 'Antes de pagar, compruebe que realmente lo debe y quién lo reclama. Busque el plazo en el original (no detectado); pague {amount} u oponga su desacuerdo por escrito a tiempo.',
      it: "Prima di pagare, verifica di dovere davvero questa somma e chi la chiede. Cerca la scadenza sull'originale (non rilevata); paga {amount} o contesta per iscritto in tempo.",
      pt: 'Antes de pagar, confirme que deve mesmo este valor e quem o pede. Procure o prazo no original (não detetado); pague {amount} ou conteste por escrito a tempo.',
    },
  },
  utility_bill: {
    withDate: {
      en: 'Check the meter readings and period, then pay {amount} by {date} (or make sure the direct debit covers it).',
      de: 'Prüfen Sie Zählerstände und Zeitraum und zahlen Sie dann {amount} bis {date} (oder sorgen Sie dafür, dass die Lastschrift gedeckt ist).',
      fr: 'Vérifiez les relevés et la période, puis payez {amount} avant le {date} (ou assurez-vous que le prélèvement passera).',
      es: 'Compruebe las lecturas y el periodo, y pague {amount} antes del {date} (o asegúrese de que la domiciliación tenga saldo).',
      it: "Controlla letture e periodo, poi paga {amount} entro il {date} (o assicurati che l'addebito diretto vada a buon fine).",
      pt: 'Verifique as leituras e o período e pague {amount} até {date} (ou garanta que o débito direto tem saldo).',
    },
    noDate: {
      en: 'Check the meter readings and period, find the due date on the original (not detected), then pay {amount} in time.',
      de: 'Prüfen Sie Zählerstände und Zeitraum, suchen Sie das Fälligkeitsdatum im Original (nicht erkannt) und zahlen Sie {amount} rechtzeitig.',
      fr: "Vérifiez les relevés et la période, cherchez la date d'échéance sur l'original (non détectée), puis payez {amount} à temps.",
      es: 'Compruebe las lecturas y el periodo, busque la fecha de vencimiento en el original (no detectada) y pague {amount} a tiempo.',
      it: "Controlla letture e periodo, cerca la scadenza sull'originale (non rilevata), poi paga {amount} in tempo.",
      pt: 'Verifique as leituras e o período, procure a data-limite no original (não detetada) e pague {amount} a tempo.',
    },
  },
  benefits_office: {
    withDate: {
      en: 'Send the requested documents (or go to the appointment) by {date}. If you miss it, payments can be reduced or stopped; ask the office if you need more time.',
      de: 'Schicken Sie die angeforderten Unterlagen (oder gehen Sie zum Termin) bis {date}. Wenn Sie die Frist verpassen, können Leistungen gekürzt oder gestoppt werden; bitten Sie bei Bedarf um mehr Zeit.',
      fr: "Envoyez les pièces demandées (ou allez au rendez-vous) avant le {date}. Sinon, vos aides peuvent être réduites ou suspendues ; demandez un délai si nécessaire.",
      es: 'Envíe los documentos solicitados (o acuda a la cita) antes del {date}. Si no lo hace, la prestación puede reducirse o suspenderse; pida más plazo si lo necesita.',
      it: "Invia i documenti richiesti (o vai all'appuntamento) entro il {date}. Altrimenti le prestazioni possono essere ridotte o sospese; chiedi più tempo se ti serve.",
      pt: 'Envie os documentos pedidos (ou vá à marcação) até {date}. Se não o fizer, a prestação pode ser reduzida ou suspensa; peça mais tempo se precisar.',
    },
    noDate: {
      en: 'Find the deadline on the original (not detected) and send the requested documents in time. Ask the office if anything is unclear.',
      de: 'Suchen Sie die Frist im Original (nicht erkannt) und schicken Sie die Unterlagen rechtzeitig. Fragen Sie beim Amt nach, wenn etwas unklar ist.',
      fr: "Cherchez la date limite sur l'original (non détectée) et envoyez les pièces à temps. Demandez à l'organisme si quelque chose n'est pas clair.",
      es: 'Busque el plazo en el original (no detectado) y envíe los documentos a tiempo. Pregunte en la oficina si algo no está claro.',
      it: "Cerca la scadenza sull'originale (non rilevata) e invia i documenti in tempo. Chiedi all'ufficio se qualcosa non è chiaro.",
      pt: 'Procure o prazo no original (não detetado) e envie os documentos a tempo. Pergunte nos serviços se algo não estiver claro.',
    },
  },
  broadcast_fee: {
    withDate: {
      en: 'Pay {amount} by {date}, or, if you are exempt or already pay at this address, tell them in writing before then.',
      de: 'Zahlen Sie {amount} bis {date} oder teilen Sie vorher schriftlich mit, wenn Sie befreit sind oder an dieser Adresse schon jemand zahlt.',
      fr: "Payez {amount} avant le {date} ou, si vous êtes exonéré ou si quelqu'un paie déjà à cette adresse, signalez-le par écrit avant.",
      es: 'Pague {amount} antes del {date} o, si está exento o alguien ya paga en esta dirección, comuníquelo por escrito antes.',
      it: "Paga {amount} entro il {date} oppure, se sei esente o qualcuno paga già a questo indirizzo, comunicalo per iscritto prima.",
      pt: 'Pague {amount} até {date} ou, se estiver isento ou alguém já pagar nesta morada, comunique-o por escrito antes.',
    },
    noDate: {
      en: 'Find the due date on the original (not detected). Pay {amount}, or tell them in writing if you are exempt or already pay at this address.',
      de: 'Suchen Sie die Fälligkeit im Original (nicht erkannt). Zahlen Sie {amount} oder teilen Sie schriftlich mit, wenn Sie befreit sind oder schon zahlen.',
      fr: "Cherchez l'échéance sur l'original (non détectée). Payez {amount} ou signalez par écrit si vous êtes exonéré ou payez déjà.",
      es: 'Busque el vencimiento en el original (no detectado). Pague {amount} o comunique por escrito si está exento o ya paga.',
      it: "Cerca la scadenza sull'originale (non rilevata). Paga {amount} o comunica per iscritto se sei esente o paghi già.",
      pt: 'Procure a data-limite no original (não detetada). Pague {amount} ou comunique por escrito se estiver isento ou já pagar.',
    },
  },
};

export const V1_REPLY: Record<V1Type, T> = {
  tax_office: {
    en: 'Dear Sir or Madam,\nRegarding your letter{refPart}: I do not fully understand it as I am still learning the language. Could you please confirm what I need to do, the deadline, and the amount due, if any?\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich Ihres Schreibens{refPart}: Ich verstehe es nicht vollständig, da ich die Sprache noch lerne. Könnten Sie mir bitte bestätigen, was ich tun muss, bis wann und ob ein Betrag fällig ist?\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant votre courrier{refPart} : je ne le comprends pas entièrement, car j'apprends encore la langue. Pourriez-vous me confirmer ce que je dois faire, la date limite et le montant éventuellement dû ?\nCordialement",
    es: 'Estimados señores:\nEn relación con su carta{refPart}: no la entiendo del todo porque todavía estoy aprendiendo el idioma. ¿Podrían confirmarme qué debo hacer, el plazo y, en su caso, el importe?\nAtentamente',
    it: "Gentili Signori,\nin merito alla vostra lettera{refPart}: non la comprendo del tutto perché sto ancora imparando la lingua. Potreste confermarmi cosa devo fare, entro quando e l'eventuale importo dovuto?\nCordiali saluti",
    pt: 'Exmos. Senhores,\nRelativamente à vossa carta{refPart}: não a compreendo totalmente, pois ainda estou a aprender a língua. Poderiam confirmar o que devo fazer, o prazo e o valor devido, se houver?\nCom os melhores cumprimentos',
  },
  health_insurance: {
    en: 'Dear Sir or Madam,\nRegarding your letter{refPart}: could you please tell me which documents or payment you need from me, by when, and whether my insurance cover is affected?\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich Ihres Schreibens{refPart}: Könnten Sie mir bitte mitteilen, welche Unterlagen oder Zahlung Sie von mir benötigen, bis wann, und ob mein Versicherungsschutz betroffen ist?\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant votre courrier{refPart} : pourriez-vous m'indiquer quels documents ou quel paiement vous attendez de moi, pour quelle date, et si ma couverture est concernée ?\nCordialement",
    es: 'Estimados señores:\nEn relación con su carta{refPart}: ¿podrían indicarme qué documentos o pago necesitan, hasta cuándo y si mi cobertura se ve afectada?\nAtentamente',
    it: 'Gentili Signori,\nin merito alla vostra lettera{refPart}: potreste indicarmi quali documenti o pagamenti vi servono, entro quando e se la mia copertura è interessata?\nCordiali saluti',
    pt: 'Exmos. Senhores,\nRelativamente à vossa carta{refPart}: poderiam indicar que documentos ou pagamento precisam de mim, até quando, e se a minha cobertura é afetada?\nCom os melhores cumprimentos',
  },
  debt_collection: {
    en: 'Dear Sir or Madam,\nRegarding your claim{refPart}: please send me proof of the original debt (creditor, contract or invoice, and how the amount is calculated). I will not pay until I have checked it. I dispute any amount I cannot verify.\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich Ihrer Forderung{refPart}: Bitte senden Sie mir einen Nachweis der ursprünglichen Forderung (Gläubiger, Vertrag oder Rechnung und Aufschlüsselung des Betrags). Vor einer Prüfung werde ich nicht zahlen. Beträge, die ich nicht nachvollziehen kann, bestreite ich.\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant votre réclamation{refPart} : merci de m'envoyer la preuve de la dette d'origine (créancier, contrat ou facture et détail du montant). Je ne paierai pas avant de l'avoir vérifiée. Je conteste tout montant que je ne peux pas vérifier.\nCordialement",
    es: 'Estimados señores:\nEn relación con su reclamación{refPart}: les ruego que me envíen prueba de la deuda original (acreedor, contrato o factura y desglose del importe). No pagaré hasta haberlo comprobado. Me opongo a cualquier importe que no pueda verificar.\nAtentamente',
    it: "Gentili Signori,\nin merito alla vostra richiesta{refPart}: vi prego di inviarmi la prova del debito originario (creditore, contratto o fattura e dettaglio dell'importo). Non pagherò prima di averlo verificato. Contesto qualsiasi importo che non posso verificare.\nCordiali saluti",
    pt: 'Exmos. Senhores,\nRelativamente à vossa cobrança{refPart}: peço que me enviem prova da dívida original (credor, contrato ou fatura e discriminação do valor). Não pagarei antes de a verificar. Contesto qualquer valor que não possa confirmar.\nCom os melhores cumprimentos',
  },
  utility_bill: {
    en: 'Dear Sir or Madam,\nRegarding invoice{refPart}: could you please explain the amount and the billing period, and confirm the payment deadline and the account to pay into?\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich der Rechnung{refPart}: Könnten Sie mir bitte den Betrag und den Abrechnungszeitraum erklären und die Zahlungsfrist sowie das Konto bestätigen?\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant la facture{refPart} : pourriez-vous m'expliquer le montant et la période facturée, et me confirmer la date limite de paiement et le compte à utiliser ?\nCordialement",
    es: 'Estimados señores:\nEn relación con la factura{refPart}: ¿podrían explicarme el importe y el periodo facturado, y confirmarme el plazo de pago y la cuenta?\nAtentamente',
    it: "Gentili Signori,\nin merito alla bolletta{refPart}: potreste spiegarmi l'importo e il periodo di fatturazione e confermarmi la scadenza e il conto su cui pagare?\nCordiali saluti",
    pt: 'Exmos. Senhores,\nRelativamente à fatura{refPart}: poderiam explicar o valor e o período faturado e confirmar o prazo de pagamento e a conta?\nCom os melhores cumprimentos',
  },
  benefits_office: {
    en: 'Dear Sir or Madam,\nRegarding your letter{refPart}: I want to do everything required. Could you please confirm which documents you need, by when, and how I can send them? If I need more time, I would like to ask for an extension.\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich Ihres Schreibens{refPart}: Ich möchte alles Erforderliche erledigen. Könnten Sie mir bitte bestätigen, welche Unterlagen Sie bis wann benötigen und wie ich sie einreichen kann? Falls ich mehr Zeit brauche, bitte ich um Fristverlängerung.\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant votre courrier{refPart} : je souhaite faire tout le nécessaire. Pourriez-vous me confirmer de quelles pièces vous avez besoin, pour quelle date, et comment les envoyer ? Si j'ai besoin de plus de temps, je sollicite un délai.\nCordialement",
    es: 'Estimados señores:\nEn relación con su carta{refPart}: quiero cumplir con todo lo necesario. ¿Podrían confirmarme qué documentos necesitan, hasta cuándo y cómo enviarlos? Si necesito más tiempo, solicito una prórroga.\nAtentamente',
    it: 'Gentili Signori,\nin merito alla vostra lettera{refPart}: desidero fare tutto il necessario. Potreste confermarmi quali documenti servono, entro quando e come inviarli? Se mi servirà più tempo, chiedo una proroga.\nCordiali saluti',
    pt: 'Exmos. Senhores,\nRelativamente à vossa carta{refPart}: quero cumprir tudo o que for necessário. Poderiam confirmar que documentos precisam, até quando e como os enviar? Se precisar de mais tempo, peço uma prorrogação.\nCom os melhores cumprimentos',
  },
  broadcast_fee: {
    en: 'Dear Sir or Madam,\nRegarding your letter{refPart}: please confirm whether I have to pay for this address, the amount and the period. [If applicable: someone at this address already pays under contribution number ___ / I apply for exemption.]\nKind regards',
    de: 'Sehr geehrte Damen und Herren,\nbezüglich Ihres Schreibens{refPart}: Bitte bestätigen Sie, ob ich für diese Wohnung zahlen muss, sowie Betrag und Zeitraum. [Falls zutreffend: In dieser Wohnung zahlt bereits jemand unter der Beitragsnummer ___ / Ich beantrage eine Befreiung.]\nMit freundlichen Grüßen',
    fr: "Madame, Monsieur,\nConcernant votre courrier{refPart} : merci de me confirmer si je dois payer pour cette adresse, le montant et la période. [Le cas échéant : une personne paie déjà à cette adresse sous le numéro ___ / je demande une exonération.]\nCordialement",
    es: 'Estimados señores:\nEn relación con su carta{refPart}: les ruego que confirmen si debo pagar por esta dirección, el importe y el periodo. [Si procede: alguien ya paga en esta dirección con el número ___ / solicito la exención.]\nAtentamente',
    it: "Gentili Signori,\nin merito alla vostra lettera{refPart}: vi prego di confermare se devo pagare per questo indirizzo, l'importo e il periodo. [Se del caso: qualcuno paga già a questo indirizzo con il numero ___ / chiedo l'esenzione.]\nCordiali saluti",
    pt: 'Exmos. Senhores,\nRelativamente à vossa carta{refPart}: confirmem, por favor, se tenho de pagar por esta morada, o valor e o período. [Se aplicável: alguém já paga nesta morada com o número ___ / peço a isenção.]\nCom os melhores cumprimentos',
  },
};

/** Document type names for the twelve UI-only languages. Unreviewed by native speakers. */
export const TYPE_LABEL_EXTRA: Record<string, Record<string, string>> = {
  parking_fine: { tr: 'park / trafik cezası', ar: 'مخالفة وقوف / مرور', pl: 'mandat za parkowanie / wykroczenie drogowe', ru: 'штраф за парковку / нарушение ПДД', uk: 'штраф за паркування / порушення ПДР', fa: 'جریمه‌ی پارک / رانندگی', ro: 'amendă de parcare / circulație', vi: 'phạt đỗ xe / giao thông', zh: '停车 / 交通罚单', tl: 'multa sa parking / trapiko', hi: 'पार्किंग / ट्रैफ़िक जुर्माना', ur: 'پارکنگ / ٹریفک جرمانہ' },
  medicine_label: { tr: 'ilaç etiketi', ar: 'ملصق دواء', pl: 'etykieta leku', ru: 'этикетка лекарства', uk: 'етикетка ліків', fa: 'برچسب دارو', ro: 'etichetă de medicament', vi: 'nhãn thuốc', zh: '药品标签', tl: 'label ng gamot', hi: 'दवा का लेबल', ur: 'دوا کا لیبل' },
  airline_cancellation: { tr: 'uçuş iptali', ar: 'إلغاء رحلة طيران', pl: 'odwołany lot', ru: 'отмена рейса', uk: 'скасування рейсу', fa: 'لغو پرواز', ro: 'zbor anulat', vi: 'hủy chuyến bay', zh: '航班取消', tl: 'kanseladong flight', hi: 'उड़ान रद्दीकरण', ur: 'پرواز کی منسوخی' },
  hotel_cancellation: { tr: 'otel rezervasyonu / iptal koşulları', ar: 'حجز فندق / شروط الإلغاء', pl: 'rezerwacja hotelu / warunki anulowania', ru: 'бронь отеля / условия отмены', uk: 'бронювання готелю / умови скасування', fa: 'رزرو هتل / شرایط لغو', ro: 'rezervare la hotel / condiții de anulare', vi: 'đặt phòng khách sạn / điều kiện hủy', zh: '酒店预订 / 取消条款', tl: 'booking sa hotel / kondisyon ng pagkansela', hi: 'होटल बुकिंग / रद्दीकरण शर्तें', ur: 'ہوٹل بکنگ / منسوخی کی شرائط' },
  visa_entry: { tr: 'vize / giriş / oturum yazısı', ar: 'رسالة تأشيرة / دخول / إقامة', pl: 'pismo wizowe / wjazdowe / pobytowe', ru: 'письмо о визе / въезде / ВНЖ', uk: 'лист щодо візи / в’їзду / посвідки', fa: 'نامه‌ی ویزا / ورود / اقامت', ro: 'scrisoare de viză / intrare / ședere', vi: 'thư thị thực / nhập cảnh / cư trú', zh: '签证 / 入境 / 居留信函', tl: 'sulat tungkol sa visa / pagpasok / paninirahan', hi: 'वीज़ा / प्रवेश / निवास पत्र', ur: 'ویزا / داخلے / رہائش کا خط' },
  rental_move_in: { tr: 'kiralık daire teslim tutanağı', ar: 'محضر استلام سكن مستأجر', pl: 'protokół zdawczo-odbiorczy mieszkania', ru: 'акт приёма-передачи жилья', uk: 'акт приймання-передачі житла', fa: 'صورت‌جلسه‌ی تحویل خانه‌ی اجاره‌ای', ro: 'proces-verbal de predare a locuinței', vi: 'biên bản bàn giao nhà thuê', zh: '租房交接单', tl: 'papel sa paglipat sa paupahan', hi: 'किराये के घर की हस्तांतरण सूची', ur: 'کرائے کے گھر کی حوالگی کی فہرست' },
  tax_office: { tr: 'vergi dairesi yazısı', ar: 'رسالة من مصلحة الضرائب', pl: 'pismo z urzędu skarbowego', ru: 'письмо налоговой', uk: 'лист податкової', fa: 'نامه‌ی اداره‌ی مالیات', ro: 'scrisoare de la fisc', vi: 'thư của cơ quan thuế', zh: '税务局信函', tl: 'sulat mula sa tanggapan ng buwis', hi: 'कर विभाग का पत्र', ur: 'محکمہ ٹیکس کا خط' },
  health_insurance: { tr: 'sağlık sigortası yazısı', ar: 'رسالة تأمين صحي', pl: 'pismo z ubezpieczenia zdrowotnego', ru: 'письмо медицинской страховки', uk: 'лист медичного страхування', fa: 'نامه‌ی بیمه‌ی درمانی', ro: 'scrisoare de la asigurarea de sănătate', vi: 'thư bảo hiểm y tế', zh: '医疗保险信函', tl: 'sulat mula sa health insurance', hi: 'स्वास्थ्य बीमा का पत्र', ur: 'صحت بیمہ کا خط' },
  debt_collection: { tr: 'ödeme hatırlatması / icra takibi', ar: 'تذكير بالدفع / تحصيل ديون', pl: 'wezwanie do zapłaty / windykacja', ru: 'напоминание об оплате / взыскание долга', uk: 'нагадування про оплату / стягнення боргу', fa: 'یادآوری پرداخت / وصول بدهی', ro: 'somație de plată / recuperare de datorii', vi: 'nhắc thanh toán / đòi nợ', zh: '付款提醒 / 催收', tl: 'paalala sa bayad / paniningil ng utang', hi: 'भुगतान अनुस्मारक / कर्ज़ वसूली', ur: 'ادائیگی کی یاد دہانی / قرض کی وصولی' },
  utility_bill: { tr: 'fatura (elektrik, gaz, su, internet)', ar: 'فاتورة خدمات (كهرباء، غاز، ماء، إنترنت)', pl: 'rachunek (prąd, gaz, woda, internet)', ru: 'счёт за коммунальные услуги / связь', uk: 'рахунок за комунальні послуги / зв’язок', fa: 'قبض (برق، گاز، آب، اینترنت)', ro: 'factură (curent, gaz, apă, internet)', vi: 'hóa đơn (điện, gas, nước, internet)', zh: '账单（电、燃气、水、网络）', tl: 'bill (kuryente, gas, tubig, internet)', hi: 'बिल (बिजली, गैस, पानी, इंटरनेट)', ur: 'بل (بجلی، گیس، پانی، انٹرنیٹ)' },
  benefits_office: { tr: 'sosyal yardım / iş kurumu yazısı', ar: 'رسالة من مكتب الإعانات / التوظيف', pl: 'pismo z urzędu pracy / świadczeń', ru: 'письмо из службы пособий / занятости', uk: 'лист зі служби допомоги / зайнятості', fa: 'نامه‌ی اداره‌ی کمک‌هزینه / کاریابی', ro: 'scrisoare de la agenția de ajutoare / ocupare', vi: 'thư của cơ quan trợ cấp / việc làm', zh: '福利 / 就业机构信函', tl: 'sulat mula sa tanggapan ng benepisyo / trabaho', hi: 'लाभ / रोज़गार कार्यालय का पत्र', ur: 'امدادی / روزگار دفتر کا خط' },
  broadcast_fee: { tr: 'yayın / televizyon ücreti', ar: 'رسوم البث / التلفزيون', pl: 'abonament RTV', ru: 'сбор за теле- и радиовещание', uk: 'збір за теле- та радіомовлення', fa: 'هزینه‌ی پخش رادیو و تلویزیون', ro: 'taxă radio-TV', vi: 'phí phát thanh truyền hình', zh: '广播电视费', tl: 'bayad sa broadcast / telebisyon', hi: 'प्रसारण / टीवी शुल्क', ur: 'نشریاتی / ٹی وی فیس' },
  unknown: { tr: 'bilinmeyen belge türü', ar: 'نوع مستند غير معروف', pl: 'nieznany rodzaj dokumentu', ru: 'неизвестный тип документа', uk: 'невідомий тип документа', fa: 'نوع مدرک نامعلوم', ro: 'tip de document necunoscut', vi: 'loại giấy tờ không rõ', zh: '未知文件类型', tl: 'hindi alam na uri ng dokumento', hi: 'अज्ञात दस्तावेज़ प्रकार', ur: 'نامعلوم دستاویز کی قسم' },
};
