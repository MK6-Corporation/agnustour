'use strict';
/*
 * Definição das 4 viagens e dos formulários de qualificação.
 * Textos, datas e preços conforme material fornecido pela Agnus Tour.
 * A pontuação aqui é apenas o PADRÃO — a equipe pode alterar tudo no painel (/admin).
 *
 * Categorias (máximo padrão):
 *   availability  – Disponibilidade para as datas ............ 25
 *   financial     – Compatibilidade financeira ............... 30
 *   timing        – Prazo para confirmar a reserva ............ 30
 *   preparation   – Documentação, embarque e preparo .......... 15
 */

const CATEGORIES = {
  availability: { label: 'Disponibilidade para as datas', max: 25 },
  financial: { label: 'Compatibilidade financeira', max: 30 },
  timing: { label: 'Prazo para confirmar a reserva', max: 30 },
  preparation: { label: 'Documentação, embarque e preparo', max: 15 },
};

const TRAVELERS_OPTIONS = [
  { id: 'a', label: 'Apenas eu.', travelers: 1 },
  { id: 'b', label: '2 pessoas.', travelers: 2 },
  { id: 'c', label: '3 pessoas.', travelers: 3 },
  { id: 'd', label: '4 pessoas ou mais.', travelers: 4, travelersPlus: true },
];

const PASSPORT_OPTIONS = [
  { id: 'a', label: 'Sim, já possuo.', points: 8 },
  { id: 'b', label: 'Preciso renovar.', points: 4 },
  { id: 'c', label: 'Ainda preciso emitir.', points: 3 },
  { id: 'd', label: 'Preciso de orientação sobre a documentação.', points: 2 },
];

// Faixas de orçamento das viagens internacionais (usadas no cálculo com valor de referência)
const INTL_BUDGET_OPTIONS = [
  { id: 'a', label: 'Até R$ 15.000.', points: 10, min: 0, max: 15000 },
  { id: 'b', label: 'De R$ 15.001 a R$ 20.000.', points: 18, min: 15001, max: 20000 },
  { id: 'c', label: 'De R$ 20.001 a R$ 25.000.', points: 25, min: 20001, max: 25000 },
  { id: 'd', label: 'Acima de R$ 25.000.', points: 30, min: 25001, max: null },
];

const TRIPS = [
  {
    id: 'mexico-cancun',
    code: 'MX',
    name: 'México e Cancún',
    leader: 'Pe. Lidiomar',
    visual: { word: 'México', icon: 'plane' },
    images: [],
    scope: 'Internacional',
    international: true,
    dateLabel: 'Agosto',
    duration: '9 dias',
    transport: 'Aéreo',
    route: 'Cuiabá → São Paulo → Cidade do México → Mérida → Riviera Maya (Cancún) → São Paulo',
    pricePrefix: 'A partir de',
    priceLabel: 'R$ 22.000',
    priceNote: 'parcelado até a data da viagem',
    referencePrice: 22000,
    summary:
      'Basílica de Guadalupe com missa, Tulpetlac, Cuautitlán, Mérida, Chichén Itzá e dias de descanso na Riviera Maya em hotel All Inclusive.',
    highlights: [
      'Cidade do México: Zócalo, Catedral Metropolitana, Palácio Nacional e Capela de San José de Altillo',
      'Basílica de Nossa Senhora de Guadalupe, com participação na missa',
      'Tulpetlac e Cuautitlán, a cidade de Juan Diego',
      'Mérida (centro histórico) e Chichén Itzá, Patrimônio Mundial da UNESCO',
      'Riviera Maya em hotel All Inclusive, com dias livres de praia e piscina',
      'Sugestões opcionais: Santuário Maria Desatadora dos Nós e Xcaret com o show “México Espetacular”',
    ],
    form: {
      title: 'Viva uma experiência inesquecível no México e Cancún!',
      description: 'Responda às perguntas e receba o roteiro completo e as condições da viagem.',
      questions: [
        {
          id: 'q1', role: 'availability', category: 'availability',
          short: 'Disponibilidade em agosto', text: 'Você tem disponibilidade para realizar essa viagem em agosto?',
          options: [
            { id: 'a', label: 'Sim, tenho disponibilidade confirmada.', points: 25 },
            { id: 'b', label: 'Preciso ajustar minha agenda.', points: 12 },
            { id: 'c', label: 'Não tenho disponibilidade nesse período.', points: 0 },
          ],
        },
        {
          id: 'q2', role: 'boarding', category: 'preparation',
          short: 'Cidade de embarque', text: 'De qual cidade pretende embarcar?',
          options: [
            { id: 'a', label: 'Cuiabá – MT.', points: 7 },
            { id: 'b', label: 'Outra cidade de Mato Grosso.', points: 6 },
            { id: 'c', label: 'Outro estado.', points: 5 },
            { id: 'd', label: 'Preciso de orientação sobre o embarque.', points: 3 },
          ],
        },
        { id: 'q3', role: 'travelers', category: null, short: 'Quantidade de pessoas', text: 'Quantas pessoas pretendem viajar?', options: TRAVELERS_OPTIONS },
        {
          id: 'q4', role: 'passport', category: 'preparation',
          short: 'Passaporte', text: 'Você possui passaporte válido para a viagem?',
          options: PASSPORT_OPTIONS,
        },
        {
          id: 'q5', role: 'budget', category: 'financial', budgetBands: true,
          short: 'Orçamento por pessoa', text: 'Qual é o seu orçamento disponível por pessoa para essa viagem internacional?',
          options: INTL_BUDGET_OPTIONS,
        },
        {
          id: 'q6', role: 'timing', category: 'timing',
          short: 'Previsão de reserva', text: 'Caso a proposta esteja dentro do seu orçamento, quando pretende realizar sua reserva?',
          options: [
            { id: 'a', label: 'Nos próximos 7 dias.', points: 30 },
            { id: 'b', label: 'Nos próximos 15 dias.', points: 22 },
            { id: 'c', label: 'Nos próximos 30 dias.', points: 14 },
            { id: 'd', label: 'Estou apenas pesquisando.', points: 3 },
          ],
        },
      ],
    },
    itinerary: [
      { day: 1, title: 'Cuiabá / São Paulo / Cidade do México', text: 'Apresentação no aeroporto para embarque com destino à Cidade do México (tempo de voo: 8 a 10 horas). Chegada no final do dia, recepção e traslado em van/ônibus ao hotel. Acomodação, jantar e pernoite.' },
      { day: 2, title: 'Cidade do México', text: 'Após o café da manhã, saída para visita panorâmica pela cidade, com os principais pontos: Zócalo (Plaza de la Constitución), Catedral Metropolitana e Palácio Nacional. À tarde, visita à Capela de San José de Altillo (relíquias da Beata Conchita). Retorno ao hotel, jantar e pernoite.' },
      { day: 3, title: 'Cidade do México (Guadalupe)', text: 'Café da manhã e saída para a Basílica de Nossa Senhora de Guadalupe, principal santuário católico do México e um dos locais religiosos mais visitados do mundo. Participação na missa, tempo para devoção, fotos e compras.' },
      { day: 4, title: 'Tulpetlac / Cuautitlán', text: 'Após o café da manhã, saída para Tulpetlac, reconhecida como o lugar da Quinta Aparição Guadalupana, onde a Virgem Maria apareceu a Juan Bernardino, tio de Juan Diego. Em seguida, Cuautitlán, conhecida como a "cidade de Juan Diego".' },
      { day: 5, title: 'Cidade do México / Mérida', text: 'Traslado ao aeroporto para embarque com destino a Mérida. Chegada, visita ao centro histórico e principais atrativos da cidade. Almoço, acomodação, jantar e pernoite.' },
      { day: 6, title: 'Mérida / Chichén Itzá / Cenote / Riviera Maya', text: 'Após o café da manhã, saída para Chichén Itzá, antigo sítio arqueológico maia, Patrimônio Mundial da UNESCO. Visita ao sítio arqueológico e almoço. Em seguida, Riviera Maya. Acomodação em hotel All Inclusive, jantar e pernoite.' },
      { day: 7, title: 'Riviera Maya (Cancún)', text: 'Dia livre para aproveitar o hotel (praia, piscina etc.). Sugestão: Santuário Maria Desatadora dos Nós, primeiro santuário católico dedicado a essa devoção mariana no México.' },
      { day: 8, title: 'Riviera Maya', text: 'Dia livre para aproveitar o hotel (praia, piscina etc.). Sugestão: Xcaret, com participação no show "México Espetacular", jantar incluído.' },
      { day: 9, title: 'Riviera Maya / São Paulo', text: 'Café da manhã e traslado ao aeroporto de Cancún para embarque com destino a São Paulo.' },
    ],
    itineraryNote: 'Horários e ordem das visitas podem sofrer ajustes conforme a operação local.',
  },
  {
    id: 'terra-santa-roma',
    code: 'TS',
    name: 'Terra Santa e Roma',
    leader: 'Pe. Elenildo',
    visual: { word: 'Terra Santa', icon: 'cross' },
    images: [],
    scope: 'Internacional',
    international: true,
    dateLabel: '04 a 16 de novembro de 2027',
    duration: '13 dias',
    transport: 'Aéreo',
    route: 'São Paulo → Tel Aviv → Galileia → Belém / Jerusalém → Roma → Assis → São Paulo',
    pricePrefix: 'A partir de',
    priceLabel: 'R$ 23.000',
    priceNote: 'parcelado até a data da viagem',
    referencePrice: 23000,
    summary:
      'Galileia, Rio Jordão, Belém e Jerusalém, com Via-Sacra e Santo Sepulcro. Em Roma, Vaticano no Angelus e excursão a Assis.',
    highlights: [
      'Galileia: Monte Tabor, Caná, Basílica da Anunciação, Cafarnaum, Tabgha, Monte das Bem-Aventuranças e travessia do Lago de Tiberíades',
      'Rio Jordão, com renovação das promessas do Batismo',
      'Judeia: Ein-Karem, Basílica da Natividade em Belém, Monte das Oliveiras, Monte Sião, Via-Sacra pela Via Dolorosa, Santo Sepulcro e Muro das Lamentações',
      'Roma: Coliseu, Fórum Romano, Fontana di Trevi, Panteão e Vaticano (Angelus)',
      'Assis: Basílica de São Francisco e Basílica de Santa Clara',
    ],
    form: {
      title: 'Realize o sonho de conhecer a Terra Santa e Roma!',
      description:
        'Participe desta peregrinação por lugares marcantes da fé cristã. Preencha o formulário para conhecer as condições.',
      questions: [
        {
          id: 'q1', role: 'availability', category: 'availability',
          short: 'Disponibilidade de 04 a 16/11/2027', text: 'Você tem disponibilidade para viajar de 04 a 16 de novembro de 2027?',
          options: [
            { id: 'a', label: 'Sim, tenho disponibilidade confirmada.', points: 25 },
            { id: 'b', label: 'Preciso organizar minha agenda.', points: 12 },
            { id: 'c', label: 'Não tenho disponibilidade nessas datas.', points: 0 },
          ],
        },
        {
          id: 'q2', role: 'boarding', category: 'preparation',
          short: 'Embarque em São Paulo', text: 'O embarque internacional está previsto para São Paulo. Você consegue se organizar para partir dessa cidade?',
          options: [
            { id: 'a', label: 'Sim, consigo embarcar em São Paulo.', points: 7 },
            { id: 'b', label: 'Moro em outra cidade e precisarei organizar o deslocamento.', points: 5 },
            { id: 'c', label: 'Preciso de mais informações sobre o embarque.', points: 3 },
          ],
        },
        { id: 'q3', role: 'travelers', category: null, short: 'Quantidade de pessoas', text: 'Quantas pessoas pretendem participar da peregrinação?', options: TRAVELERS_OPTIONS },
        {
          id: 'q4', role: 'passport', category: 'preparation',
          short: 'Passaporte', text: 'Você possui passaporte válido para realizar essa viagem internacional?',
          options: PASSPORT_OPTIONS,
        },
        {
          id: 'q5', role: 'budget', category: 'financial', budgetBands: true,
          short: 'Investimento por pessoa', text: 'Qual faixa de investimento por pessoa está dentro do seu planejamento?',
          options: INTL_BUDGET_OPTIONS,
        },
        {
          id: 'q6', role: 'timing', category: 'timing',
          short: 'Previsão para confirmar', text: 'Se as condições atenderem às suas expectativas, quando pretende confirmar sua participação?',
          options: [
            { id: 'a', label: 'Nos próximos 7 dias.', points: 30 },
            { id: 'b', label: 'Nos próximos 15 dias.', points: 22 },
            { id: 'c', label: 'Nos próximos 30 dias.', points: 14 },
            { id: 'd', label: 'Estou pesquisando e planejando a viagem.', points: 3 },
          ],
        },
      ],
    },
    itinerary: [
      { day: 1, date: 'Qui. 04/11', title: 'São Paulo / Tel Aviv', text: 'Em horário apropriado, apresentação no aeroporto para embarque com destino a Tel Aviv, com as devidas conexões.' },
      { day: 2, date: 'Sex. 05/11', title: 'Tel Aviv / Galileia', text: 'Chegada, recepção no aeroporto e traslado em ônibus privativo à Galileia. Acomodação e pernoite.' },
      { day: 3, date: 'Sáb. 06/11', title: 'Galileia', text: 'Após o café da manhã, visita ao Monte Tabor (Basílica da Transfiguração) e a Caná da Galileia. À tarde, Basílica da Anunciação, onde Maria recebeu o anúncio do Arcanjo Gabriel.' },
      { day: 4, date: 'Dom. 07/11', title: 'Galileia', text: 'Após o café da manhã, travessia do Lago de Tiberíades. Visita a Cafarnaum (Casa de São Pedro e ruínas da antiga sinagoga) e a Tabgha (Primado de São Pedro e multiplicação dos pães). À tarde, Monte das Bem-Aventuranças. Retorno ao hotel, jantar e pernoite.' },
      { day: 5, date: 'Seg. 08/11', title: 'Galileia / Judeia', text: 'Após o café da manhã, parada no Rio Jordão para a renovação das promessas do Batismo. Continuação para a Judeia. Acomodação em Belém, jantar e pernoite.' },
      { day: 6, date: 'Ter. 09/11', title: 'Judeia', text: 'Após o café da manhã, visita a Ein-Karem, local do encontro de Maria com Isabel e do cântico do Magnificat. À tarde, Basílica da Natividade, local do nascimento de Jesus, Gruta dos Inocentes e Gruta de São Jerônimo. Retorno ao hotel, jantar e pernoite.' },
      { day: 7, date: 'Qua. 10/11', title: 'Judeia', text: 'Após o café da manhã, visita ao Monte das Oliveiras (Igreja da Ascensão, Pater Noster e Basílica da Agonia). À tarde, Monte Sião (Cenáculo, Igreja da Dormição de Maria e Igreja de São Pedro in Gallicantu). Retorno ao hotel, jantar e pernoite.' },
      { day: 8, date: 'Qui. 11/11', title: 'Judeia', text: 'Após o café da manhã, visita à Igreja de Sant’Ana e percurso da Via-Sacra pela Via Dolorosa (Capela da Flagelação e Capela da Condenação). Visita ao Santo Sepulcro e ao Muro das Lamentações. Retorno ao hotel, jantar e pernoite.' },
      { day: 9, date: 'Sex. 12/11', title: 'Judeia / Tel Aviv / Roma', text: 'Em horário apropriado, traslado ao aeroporto de Tel Aviv para embarque com destino a Roma. Chegada, recepção e acomodação no hotel. Jantar e pernoite.' },
      { day: 10, date: 'Sáb. 13/11', title: 'Roma — Centro Histórico', text: 'City tour pelo Coliseu, Fórum Romano, Fontana di Trevi e Panteão. Jantar e pernoite.' },
      { day: 11, date: 'Dom. 14/11', title: 'Roma — Vaticano (Angelus)', text: 'City tour.' },
      { day: 12, date: 'Seg. 15/11', title: 'Roma / Assis / Roma', text: 'Excursão a Assis, visitando a Basílica de São Francisco e a Basílica de Santa Clara. Retorno a Roma. Jantar e pernoite.' },
      { day: 13, date: 'Ter. 16/11', title: 'Roma / São Paulo', text: 'Transfer ao aeroporto para embarque com destino a São Paulo, via devidas conexões.' },
    ],
    itineraryNote: 'Horários e ordem das visitas podem sofrer ajustes conforme a operação local.',
  },
  {
    id: 'aparecida-pe-idlain',
    code: 'AI',
    name: 'Aparecida e Canção Nova com Pe. Idlain',
    shortName: 'Aparecida e Canção Nova',
    leader: 'Pe. Idlain',
    scope: 'Nacional',
    international: false,
    dateLabel: '05 a 12 de julho de 2027',
    duration: '8 dias',
    transport: 'Ônibus',
    route: 'Cuiabá e Primavera do Leste → Aparecida/SP → Cuiabá e Primavera do Leste',
    pricePrefix: 'A partir de',
    priceLabel: 'R$ 2.850',
    priceNote: 'até 05/07/2027',
    visual: { word: 'Aparecida', icon: 'bus' },
    images: [],
    summary: 'Aparecida/SP como base do grupo, com visitas a Guaratinguetá, Canção Nova e passeio a Campos do Jordão.',
    highlights: [
      'Aparecida/SP, com hospedagem e base do grupo durante a viagem',
      'Visita a Guaratinguetá e à Canção Nova',
      'Passeio a Campos do Jordão',
      'City tour',
    ],
    includes: ['Transporte terrestre', 'Traslados', 'City tour', 'Hospedagem com café da manhã'],
    form: {
      title: 'Peregrinação a Aparecida e Canção Nova com Pe. Idlain!',
      description: 'Viva oito dias de fé e espiritualidade. Responda às perguntas para receber os detalhes da viagem.',
      questions: [
        {
          id: 'q1', role: 'availability', category: 'availability',
          short: 'Disponibilidade de 05 a 12/07/2027', text: 'Você possui disponibilidade para viajar de 05 a 12 de julho de 2027?',
          options: [
            { id: 'a', label: 'Sim, tenho disponibilidade confirmada.', points: 25 },
            { id: 'b', label: 'Preciso organizar minha agenda.', points: 12 },
            { id: 'c', label: 'Não tenho disponibilidade nesse período.', points: 0 },
          ],
        },
        {
          id: 'q2', role: 'boarding', category: 'preparation',
          short: 'Local de embarque', text: 'Qual será seu local de embarque?',
          options: [
            { id: 'a', label: 'Cuiabá – MT.', points: 15 },
            { id: 'b', label: 'Primavera do Leste – MT.', points: 15 },
            { id: 'c', label: 'Moro em outra cidade e preciso verificar o embarque.', points: 8 },
          ],
        },
        { id: 'q3', role: 'travelers', category: null, short: 'Quantidade de pessoas', text: 'Quantas pessoas pretendem participar da peregrinação?', options: TRAVELERS_OPTIONS },
        {
          id: 'q4', role: 'budget', category: 'financial',
          short: 'Investimento de R$ 2.850', text: 'O investimento informado para essa viagem é de R$ 2.850 por pessoa. Esse valor está dentro do seu planejamento?',
          options: [
            { id: 'a', label: 'Sim, está dentro do meu orçamento.', points: 30 },
            { id: 'b', label: 'Sim, mas preciso conhecer as condições de pagamento.', points: 24 },
            { id: 'c', label: 'Preciso me organizar financeiramente.', points: 12 },
            { id: 'd', label: 'No momento, está acima do meu orçamento.', points: 0 },
          ],
        },
        {
          id: 'q6', role: 'timing', category: 'timing',
          short: 'Previsão para confirmar', text: 'Caso as condições atendam às suas expectativas, quando pretende confirmar sua vaga?',
          options: [
            { id: 'a', label: 'Nos próximos 7 dias.', points: 30 },
            { id: 'b', label: 'Nos próximos 15 dias.', points: 22 },
            { id: 'c', label: 'Nos próximos 30 dias.', points: 14 },
            { id: 'd', label: 'Ainda estou pesquisando.', points: 3 },
          ],
        },
      ],
    },
  },
  {
    id: 'aparecida-pe-welinton',
    code: 'AW',
    name: 'Aparecida e Canção Nova com Pe. Welinton',
    shortName: 'Aparecida e Canção Nova',
    leader: 'Pe. Welinton',
    scope: 'Nacional',
    international: false,
    dateLabel: '13 a 16 de setembro de 2027',
    duration: '4 dias',
    transport: 'Avião',
    route: 'Cuiabá → Aparecida/SP → Canção Nova → Cuiabá',
    pricePrefix: 'Em até',
    priceLabel: '17x de R$ 158,83',
    priceNote: null,
    visual: { word: 'Canção Nova', icon: 'plane' },
    images: [],
    summary: 'Quatro dias de fé entre o Santuário Nacional de Aparecida e a Canção Nova, com aéreo saindo de Cuiabá.',
    highlights: ['Santuário Nacional de Aparecida/SP', 'Canção Nova', 'Guia especializado'],
    includes: ['Aéreo e transfer', 'Hospedagem com café da manhã', 'Guia especializado'],
    form: {
      title: 'Peregrinação a Aparecida e Canção Nova com Pe. Welinton!',
      description: 'Viva quatro dias de fé e espiritualidade. Responda às perguntas para conhecer todos os detalhes.',
      questions: [
        {
          id: 'q1', role: 'availability', category: 'availability',
          short: 'Disponibilidade de 13 a 16/09/2027', text: 'Você tem disponibilidade para viajar de 13 a 16 de setembro de 2027?',
          options: [
            { id: 'a', label: 'Sim, tenho disponibilidade confirmada.', points: 25 },
            { id: 'b', label: 'Preciso organizar minha agenda.', points: 12 },
            { id: 'c', label: 'Não tenho disponibilidade nessas datas.', points: 0 },
          ],
        },
        {
          id: 'q2', role: 'boarding', category: 'preparation',
          short: 'Embarque em Cuiabá', text: 'O embarque aéreo está previsto para Cuiabá. Você consegue embarcar nessa cidade?',
          options: [
            { id: 'a', label: 'Sim, moro em Cuiabá.', points: 7 },
            { id: 'b', label: 'Sim, consigo me deslocar até Cuiabá.', points: 6 },
            { id: 'c', label: 'Preciso de orientação sobre o deslocamento.', points: 3 },
          ],
        },
        { id: 'q3', role: 'travelers', category: null, short: 'Quantidade de pessoas', short: 'Quantidade de pessoas', text: 'Quantas pessoas pretendem viajar?', options: TRAVELERS_OPTIONS },
        {
          id: 'q4', role: 'budget', category: 'financial',
          short: 'Parcelas de 17x R$ 158,83', text: 'A viagem possui condição informada de 17 parcelas de R$ 158,83. Essa condição está dentro do seu planejamento financeiro?',
          options: [
            { id: 'a', label: 'Sim, está dentro do meu orçamento.', points: 30 },
            { id: 'b', label: 'Tenho interesse e gostaria de conhecer as condições.', points: 22 },
            { id: 'c', label: 'Preciso me organizar financeiramente.', points: 12 },
            { id: 'd', label: 'No momento, não está dentro do meu orçamento.', points: 0 },
          ],
        },
        {
          id: 'q5', role: 'readiness', category: 'preparation',
          short: 'O que falta para confirmar', text: 'O que falta para você confirmar sua participação?',
          options: [
            { id: 'a', label: 'Apenas receber as informações para reservar.', points: 8 },
            { id: 'b', label: 'Conhecer as condições de pagamento.', points: 6 },
            { id: 'c', label: 'Confirmar com meus acompanhantes.', points: 5 },
            { id: 'd', label: 'Estou avaliando outras opções de viagem.', points: 2 },
          ],
        },
        {
          id: 'q6', role: 'timing', category: 'timing',
          short: 'Previsão de reserva', text: 'Se a proposta atender às suas expectativas, quando pretende realizar a reserva?',
          options: [
            { id: 'a', label: 'Nos próximos 7 dias.', points: 30 },
            { id: 'b', label: 'Nos próximos 15 dias.', points: 22 },
            { id: 'c', label: 'Nos próximos 30 dias.', points: 14 },
            { id: 'd', label: 'Ainda não tenho previsão.', points: 3 },
          ],
        },
      ],
    },
  },
];

function getTrip(id) {
  return TRIPS.find((t) => t.id === id) || null;
}

/** Versão pública (sem pontos) para o navegador. */
function publicTrips(withScoring = false) {
  const { tripVideo } = require('./videos');
  return TRIPS.map((t) => ({
    ...t,
    video: tripVideo(t.id),
    form: {
      ...t.form,
      questions: t.form.questions.map((q) => ({
        id: q.id,
        role: q.role,
        short: q.short,
        text: q.text,
        ...(withScoring ? { category: q.category, budgetBands: Boolean(q.budgetBands) } : {}),
        options: q.options.map((o) => (withScoring ? { id: o.id, label: o.label, points: o.points || 0, max: o.max } : { id: o.id, label: o.label })),
      })),
    },
  }));
}

module.exports = { CATEGORIES, TRIPS, getTrip, publicTrips };
