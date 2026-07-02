/**
 * Contrato de hospedagem do Solar Irará Hotel — modelo atual (será
 * substituído futuramente por versão revisada). Exibido no aceite
 * eletrônico da reserva pública. Ao trocar o texto, incremente a versão.
 */
export const CONTRACT_VERSION = 'solar-irara-hospedagem-2026-07';

export const CONTRACT_TITLE = 'Contrato de Hospedagem e Termos de Reserva';

export interface ContractClause {
  title: string;
  paragraphs: string[];
}

export const CONTRACT_INTRO =
  'Pelo presente instrumento particular, as partes têm entre si, justo e contratado, o presente Contrato de Hospedagem, que se regerá pelas cláusulas a seguir e, no que couber, pelo Código Civil (Lei nº 10.406/2002), pelo Código de Defesa do Consumidor (Lei nº 8.078/1990) e pela Lei Geral do Turismo (Lei nº 11.771/2008).';

export const CONTRACT_CLAUSES: ContractClause[] = [
  {
    title: 'Cláusula 1ª – Das partes',
    paragraphs: [
      'CONTRATADA (HOTEL): SOLAR IRARA HOTEL LTDA, nome fantasia "Solar Irará", inscrita no CNPJ sob o nº 59.563.093/0001-05, com sede na Rodovia BA-504, s/n, Bairro Centro, CEP 44.255-000, Irará/BA, representada por sua sócia administradora Karla Pinto de Cerqueira, CPF nº 045.953.965-54, doravante denominada HOTEL.',
      'CONTRATANTE (HÓSPEDE): a pessoa identificada nos dados desta reserva, doravante denominada HÓSPEDE.',
    ],
  },
  {
    title: 'Cláusula 2ª – Do objeto',
    paragraphs: [
      '2.1. Este contrato tem por objeto a prestação de serviços de hospedagem pelo HOTEL ao HÓSPEDE, compreendendo a disponibilização de acomodação e os serviços vinculados, conforme a confirmação de reserva.',
      '2.2. Por se tratar de relação de consumo, prevalece, em caso de conflito, a norma mais favorável ao HÓSPEDE, quando pessoa física.',
    ],
  },
  {
    title: 'Cláusula 3ª – Do período e das acomodações',
    paragraphs: [
      '3.1. As datas de check-in e check-out e o número de diárias são os informados no resumo desta reserva.',
      '3.2. É vedada a ocupação por número de pessoas superior à capacidade da unidade contratada.',
      '3.3. A diária inicia às 14h00 (check-in) e termina às 12h00 (check-out), independentemente do horário de chegada ou saída, salvo acordo prévio por escrito.',
    ],
  },
  {
    title: 'Cláusula 4ª – Dos valores e forma de pagamento',
    paragraphs: [
      '4.1. O valor da diária e o valor total da hospedagem são os informados no resumo desta reserva, já incluídos os tributos aplicáveis.',
      '4.2. Taxas adicionais eventuais (ISS municipal, frigobar, serviços extras, hóspede adicional) serão informadas previamente e cobradas em separado, mediante comprovação de consumo.',
      '4.3. Nesta etapa, a reserva é uma solicitação; a forma e a condição de pagamento serão combinadas diretamente com o HOTEL na confirmação.',
    ],
  },
  {
    title: 'Cláusula 5ª – Da confirmação da reserva',
    paragraphs: [
      '5.1. A solicitação de reserva será validada pelo HOTEL, que entrará em contato para confirmar a disponibilidade e as condições de pagamento.',
      '5.2. Eventual sinal pago será integralmente abatido do valor total no check-in, salvo hipóteses de retenção previstas na Cláusula 7ª.',
    ],
  },
  {
    title: 'Cláusula 6ª – Do check-in e do check-out',
    paragraphs: [
      '6.1. No check-in, todos os hóspedes deverão apresentar documento oficial de identidade com foto e preencher a Ficha Nacional de Registro de Hóspedes (FNRH).',
      '6.2. O atraso na chegada não prorroga o check-out nem gera abatimento das diárias.',
      '6.3. A permanência após o check-out sem autorização poderá ensejar a cobrança de nova diária ou fração proporcional, conforme política do HOTEL.',
    ],
  },
  {
    title: 'Cláusula 7ª – Da política de cancelamento',
    paragraphs: [
      'Ressalvado o direito de arrependimento (Cláusula 8ª), o cancelamento pelo HÓSPEDE observará tabela de retenção escalonada conforme a antecedência ao check-in:',
      '(a) mais de 15 dias: reembolso de 100%, deduzida taxa administrativa;',
      '(b) entre 7 e 15 dias: retenção de 30% do valor total;',
      '(c) entre 48 horas e 7 dias: retenção de 50% do valor total;',
      '(d) menos de 48 horas ou não comparecimento (no-show): retenção equivalente à primeira diária.',
      'As taxas têm natureza indenizatória (art. 418 do Código Civil e/ou cláusula penal). O reembolso devido será processado pelo mesmo meio de pagamento. Não há taxa em caso fortuito/força maior comprovado ou culpa exclusiva do HOTEL. O cancelamento deve ser solicitado por escrito.',
    ],
  },
  {
    title: 'Cláusula 8ª – Do direito de arrependimento',
    paragraphs: [
      '8.1. Nas reservas à distância (internet, telefone, aplicativo), o HÓSPEDE poderá se arrepender em 7 dias corridos da contratação (art. 49 do CDC), com reembolso integral e atualizado, sem taxa de cancelamento.',
      '8.2. Este direito prevalece sobre a tabela da Cláusula 7ª.',
    ],
  },
  {
    title: 'Cláusula 9ª – Da alteração de reserva',
    paragraphs: [
      '9.1. Alterações de datas ou acomodação sujeitam-se à disponibilidade e à diferença de tarifa vigente, podendo o HOTEL, uma única vez, converter valores em crédito para uso futuro, sem afastar a política de cancelamento em novas alterações.',
    ],
  },
  {
    title: 'Cláusula 10ª – Das obrigações do hóspede e regras da casa',
    paragraphs: [
      '10.1. O HÓSPEDE obriga-se a: zelar pela conservação da unidade e áreas comuns; respeitar o regulamento interno e os horários de silêncio; não exceder a capacidade; ressarcir danos que der causa; e observar as normas de segurança e convivência.',
      '10.2. O HÓSPEDE responde pelos atos de todas as pessoas registradas na reserva, inclusive menores e convidados.',
    ],
  },
  {
    title: 'Cláusula 11ª – Das obrigações do hotel',
    paragraphs: [
      '11.1. O HOTEL disponibilizará a acomodação nas condições anunciadas, prestará os serviços com adequação e segurança e informará preços, taxas e condições de forma clara (CDC).',
      '11.2. Havendo indisponibilidade por culpa do HOTEL, este providenciará acomodação equivalente ou superior sem custo, ou reembolsará integralmente.',
    ],
  },
  {
    title: 'Cláusula 12ª – Da responsabilidade por bens',
    paragraphs: [
      '12.1. Nos termos dos arts. 649 e 650 do Código Civil, o HOTEL responde pela guarda dos bens recolhidos ao estabelecimento, ressalvadas as excludentes legais.',
      '12.2. Recomenda-se o uso do cofre para dinheiro, joias e objetos de valor.',
    ],
  },
  {
    title: 'Cláusula 13ª – Da proteção de dados (LGPD)',
    paragraphs: [
      '13.1. O HÓSPEDE autoriza o tratamento de seus dados pessoais pelo HOTEL exclusivamente para execução deste contrato, cumprimento de obrigações legais (inclusive FNRH) e comunicação relativa à hospedagem (Lei nº 13.709/2018).',
      '13.2. Os dados serão armazenados pelo prazo legal e não serão compartilhados sem base legal, ressalvadas autoridades competentes quando exigido por lei.',
    ],
  },
  {
    title: 'Cláusula 14ª – Do caso fortuito e força maior',
    paragraphs: [
      '14.1. Nenhuma das partes responderá por descumprimento decorrente de caso fortuito ou força maior (art. 393 do Código Civil), como desastres naturais, calamidade pública e determinações governamentais que impeçam a hospedagem.',
    ],
  },
  {
    title: 'Cláusula 15ª – Disposições gerais e foro',
    paragraphs: [
      '15.1. A tolerância quanto ao descumprimento não implica novação nem renúncia de direitos. A nulidade de uma cláusula não prejudica as demais.',
      '15.2. Fica eleito o foro da Comarca de Irará/BA, ressalvado ao consumidor o direito de propor ação no foro de seu domicílio (art. 101, I, do CDC).',
    ],
  },
];
