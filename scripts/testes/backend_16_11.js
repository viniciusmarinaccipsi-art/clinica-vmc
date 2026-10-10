/* Pacote 16.11 — e-mail em HTML (layout do Design de 10/10/2026): testes em Node do Código.js REAL.
   Prova: texto puro e assunto iguais aos da v16.10; textos fixos letra por letra no HTML; link no botão e em
   texto; escape; linhas opcionais; nada proibido em e-mail; logo embutido (cid:logo) igual ao PNG versionado;
   e-mail sai mesmo sem o logo; avisos E3 com COGNIATIVO e acentos; envio de exemplo só ao dono.
   Nenhum dado real: nomes e links inventados; MailApp é capturado. Uso: node scripts/testes/backend_16_11.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const sign = b => Array.from(b).map(x => (x > 127 ? x - 256 : x));
const ENVIADOS = [];
const ERROS = [];
const PROPS = {};
const ctx = {
  console: { error: (...a) => ERROS.push(a.join(' ')), log: () => {}, warn: () => {} }, JSON, Math, Date, String, Object, Array, Number, parseInt, isNaN, Buffer,
  Utilities: {
    base64Decode: s => sign(Buffer.from(String(s), 'base64')),
    newBlob: (bytes, tipo, nome) => ({ bytes: Buffer.from(bytes.map(x => (x < 0 ? x + 256 : x))), tipo, nome }),
    formatDate: () => '10/10/2026 10:00:00'
  },
  MailApp: { sendEmail: m => { ENVIADOS.push(m); } },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.test' }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in PROPS ? PROPS[k] : null), setProperty: (k, v) => { PROPS[k] = String(v); } }) },
  Logger: { log: () => {} }
};
vm.createContext(ctx);
const FONTE = fs.readFileSync(path.join(RAIZ, 'Código.js'), 'utf8');
vm.runInContext(FONTE, ctx, { filename: 'Código.js' });
const G = code => vm.runInContext(code, ctx);

// montarEmail da v16.10 (antes deste pacote), isolado da fonte antiga
const FONTE_ANT = execSync('git show v16.10:Código.js', { cwd: RAIZ, maxBuffer: 1 << 26 }).toString('utf8').replace(/\r\n/g, '\n');
const iAnt = FONTE_ANT.indexOf('function montarEmail(');
const montarAntigo = new Function(FONTE_ANT.match(/^var EMAIL_DESTAQUE = .*$/m)[0] + '\n' + FONTE_ANT.slice(iAnt, FONTE_ANT.indexOf('\n}\n', iAnt) + 3) + '\nreturn montarEmail;')();

let total = 0, falhas = 0;
const ok = (nome, cond, extra) => { total++; if (!cond) { falhas++; console.log('FALHA ' + nome + (extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 400) : '')); } };
const visivel = html => html.replace(/<!--.*?-->/gs, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

const LINK = 'https://exemplo.test/index-dev.html?ativar=abc&x=1';
const ASS = G(`_assinaturaDe_('Fulana de Tal', '06/1', 'F')`);
const casos = [
  ['convite', 'Ana', LINK, '', ASS], ['convite', 'Ana', LINK, '', []], ['convite', 'Ana', LINK],
  ['redefinicao', '', LINK, '', ASS], ['redefinicao', '', LINK, 'Dr. Beto de Prova', ASS], ['redefinicao', '', LINK, 'Dr. Beto de Prova']
];
const monta = a => ctx.montarEmail.apply(null, a);

console.log('H. texto puro e assunto não mudam');
ok('H1 texto puro idêntico ao da v16.10 nos 6 casos', casos.every(a => monta(a).texto === montarAntigo.apply(null, a).texto));
ok('H2 assuntos idênticos', casos.every(a => monta(a).assunto === montarAntigo.apply(null, a).assunto));
ok('H3 VERSAO_PACOTE = 16.11', G('VERSAO_PACOTE') === '16.11');

console.log('T. textos no HTML, letra por letra');
const conv = monta(casos[0]), red = monta(casos[4]);
const fixosConv = ['Olá, Ana.', 'Seu acesso ao COGNIATIVO, o sistema de acompanhamento que usamos entre as sessões, está pronto. Para criar a sua senha, abra este link (ele vale por 48 horas e só funciona uma vez):',
  'Se você não esperava este e-mail, ignore-o. Nada será alterado.', 'Seu acesso está pronto', 'Criar minha senha', 'Crie sua senha para começar. O link vale por 48 horas.'];
const fixosRed = ['Olá.', 'Recebemos um pedido para redefinir a sua senha no COGNIATIVO. Para criar uma senha nova, abra este link (vale por 48 horas e só funciona uma vez):',
  'Se você não pediu isso, ignore este e-mail. Sua senha atual continua a mesma.', 'Redefinir a sua senha', 'Criar senha nova', 'Acompanhamento com: Dr. Beto de Prova', 'Crie uma senha nova. O link vale por 48 horas.'];
const comuns = ['COGNIATIVO — Psicoterapia para além das sessões, com intervenções cognitivo-comportamentais no dia a dia.', 'E-mail automático do COGNIATIVO. Não é preciso responder.',
  'Se o botão não abrir, copie este endereço no navegador:', 'Fulana de Tal', 'Psicóloga — CRP 06/1'];
ok('T1 convite: todos os textos fixos e novos aprovados', fixosConv.concat(comuns).every(t => visivel(conv.html).indexOf(t) !== -1), fixosConv.concat(comuns).filter(t => visivel(conv.html).indexOf(t) === -1));
ok('T2 redefinição: todos os textos fixos e novos aprovados', fixosRed.concat(comuns).every(t => visivel(red.html).indexOf(t) !== -1), fixosRed.concat(comuns).filter(t => visivel(red.html).indexOf(t) === -1));
ok('T3 rodapé sem link de privacidade (decisão de 10/10)', casos.every(a => monta(a).html.indexOf('privacidade') === -1));

console.log('L. link');
const linkEsc = LINK.replace(/&/g, '&amp;');
ok('L1 link escapado no href do botão e no endereço em texto (2 href + 1 texto)', conv.html.split('href="' + linkEsc + '"').length - 1 === 2 && conv.html.split('>' + linkEsc + '</a>').length - 1 === 1);
ok('L2 o & cru do link não aparece no HTML', conv.html.indexOf('abc&x=1') === -1);

console.log('E. escape');
const mau = monta(['convite', '<script>alert(1)</script> "Zé" & \'D\'', LINK, '', ['<b>Prof</b>', 'Psicólogo — CRP <i>1</i>']]);
ok('E1 nome e assinatura com HTML saem escapados', mau.html.indexOf('<script>') === -1 && mau.html.indexOf('<b>Prof') === -1 && mau.html.indexOf('<i>1') === -1
  && mau.html.indexOf('&lt;script&gt;alert(1)&lt;/script&gt; &quot;Zé&quot; &amp; &#39;D&#39;') !== -1);
ok('E2 _escHtml_ trata & < > " \' e vazio', G(`_escHtml_('&<>"\\'') === '&amp;&lt;&gt;&quot;&#39;' && _escHtml_(null) === '' && _escHtml_(undefined) === ''`));
ok('E3 montarEmail não tem mais escapador local', FONTE.indexOf('var esc = function') === -1);

console.log('O. linhas opcionais');
ok('O1 "Acompanhamento com:" (e a pílula lavanda) só na redefinição com profissional', [4, 5].every(k => monta(casos[k]).html.indexOf('Acompanhamento com:') !== -1)
  && [0, 1, 2, 3].every(k => monta(casos[k]).html.indexOf('Acompanhamento com:') === -1 && monta(casos[k]).html.indexOf('#E7E6F5') === -1));
ok('O2 sem CRP: só o nome, sem a segunda linha', (h => h.indexOf('<strong>Só Nome</strong></p>') !== -1 && h.indexOf('<span style="font-size:13px') === -1)(monta(['convite', 'Ana', LINK, '', ['Só Nome']]).html));
ok('O3 sem assinatura: nenhuma linha de assinatura e nenhum parágrafo vazio', (h => h.indexOf('<strong>') === -1 && !/<p[^>]*><\/p>/.test(h))(monta(casos[1]).html) && !/<p[^>]*><\/p>/.test(monta(casos[2]).html));

console.log('P. regras de e-mail');
const todos = casos.map(a => monta(a).html).concat([mau.html]);
ok('P1 nada proibido: SVG, script, style, flex/grid, data:, formulário', todos.every(h => !/<svg|<script|<style|display\s*:\s*(flex|grid)|data:|<form/i.test(h)));
ok('P2 tabelas role="presentation", logo cid:logo com alt e tamanho', todos.every(h => /<table role="presentation"/.test(h) && /<img src="cid:logo" alt="COGNIATIVO" width="240" height="56"/.test(h)));
ok('P3 cada HTML abaixo de 100 KB (o Gmail corta acima de 102 KB)', todos.every(h => Buffer.byteLength(h, 'utf8') < 100 * 1024), todos.map(h => Buffer.byteLength(h, 'utf8')));
ok('P4 zero emoji', todos.every(h => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h)));

console.log('I. logo embutido e envio');
ENVIADOS.length = 0;
ok('I1 _enviarEmail_ devolve true', G(`_enviarEmail_('p@exemplo.test', montarEmail('convite', 'Ana', 'https://x.test/?ativar=a'))`) === true && ENVIADOS.length === 1);
const m = ENVIADOS[0] || {};
const png = fs.readFileSync(path.join(RAIZ, 'docs', 'design', 'marca', 'logo-email.png'));
ok('I2 inlineImages.logo é o PNG versionado (bytes iguais), image/png', m.inlineImages && m.inlineImages.logo && m.inlineImages.logo.tipo === 'image/png' && Buffer.compare(m.inlineImages.logo.bytes, png) === 0);
ok('I3 remetente COGNIATIVO, corpo e HTML presentes', m.name === 'COGNIATIVO' && typeof m.body === 'string' && /cid:logo/.test(m.htmlBody));
ENVIADOS.length = 0; ERROS.length = 0;
const dec = ctx.Utilities.base64Decode; ctx.Utilities.base64Decode = () => { throw new Error('sem decodificador'); };
const semLogo = G(`_enviarEmail_('p@exemplo.test', montarEmail('convite', 'Ana', 'https://x.test/?ativar=a'))`);
ctx.Utilities.base64Decode = dec;
ok('I4 sem o logo o e-mail sai assim mesmo (sem inlineImages) e a falha vai para o log', semLogo === true && ENVIADOS.length === 1 && !ENVIADOS[0].inlineImages && ERROS.some(e => /_logoEmailBlob_/.test(e)));

console.log('X. exemplo ao dono');
ENVIADOS.length = 0;
const ex = G('enviarEmailsDeExemplo()');
ok('X1 dois e-mails, só para o dono, assunto marcado [Exemplo], link sem valor', ex.ok && ex.enviados === 2 && ENVIADOS.length === 2 && ENVIADOS.every(e => e.to === 'dono@exemplo.test' && /^\[Exemplo\] /.test(e.subject) && /ativar=EXEMPLO-SEM-VALOR/.test(e.body)));
ok('X2 a redefinição de exemplo mostra "Acompanhamento com:"', /Acompanhamento com: Nome do Profissional/.test(ENVIADOS[1] && ENVIADOS[1].htmlBody));
ok('X3 enviarEmailsDeExemplo não é ação do doPost', !/['"]enviarEmailsDeExemplo['"]/.test(FONTE));

console.log('A. avisos E3 ao dono');
ENVIADOS.length = 0;
G(`_e3AvisarBackup_(new Date(), 3, 2, ['erro de teste'], false)`);
G(`_e3AvisarFalhaPing_(new Date(), 'resposta inesperada', 500, 'corpo')`);
const [bk, pg] = ENVIADOS;
ok('A1 backup: assunto e remetente COGNIATIVO, acentos', bk && bk.subject === 'COGNIATIVO - backup com falha' && bk.name === 'COGNIATIVO' && /O backup não fechou limpo\./.test(bk.body) && /A retenção \(5 cópias mais recentes\) NÃO rodou nesta execução: nenhuma cópia antiga foi apagada\./.test(bk.body) && /página Execuções/.test(bk.body) && /sem conteúdo de paciente/.test(bk.body), bk);
ok('A2 ping: assunto e remetente COGNIATIVO, acentos', pg && pg.subject === 'COGNIATIVO - servidor sem resposta no ping' && pg.name === 'COGNIATIVO' && /O monitor horário não conseguiu confirmar que o servidor está no ar\./.test(pg.body) && /Código HTTP: 500/.test(pg.body) && /Início da resposta/.test(pg.body) && /implantação de produção/.test(pg.body), pg);
ok('A3 "Clinica VMC" só sobra no nome do arquivo da Controle', (FONTE.match(/Cl[ií]nica VMC/g) || []).length === (FONTE.match(/Clinica VMC - Controle/g) || []).length);

console.log(falhas ? `RESULTADO: ${falhas} FALHA(S) em ${total} provas` : `RESULTADO: OK — ${total}/${total} provas`);
process.exitCode = falhas ? 1 : 0;
