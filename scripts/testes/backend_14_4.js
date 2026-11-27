/* Pacote 14.4 — Agenda: confirmação por link, eventos, lembretes de 48 h e 24 h e e-mail na hora.
   Testes em Node do Código.js REAL sobre as planilhas simuladas do arnês de backend_18_10a.js; relógio fixo
   (o resultado não depende do dia nem do fuso).
   Blocos: L link de confirmação (ação pública) · E eventos da agenda · R lembretes de 48 h e 24 h ·
   M avisos na hora · T listas, crachá e versão.
   Uso: node scripts/testes/backend_14_4.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARNES = path.join(__dirname, 'backend_18_10a.js');
const MARCA = "console.log('C. controle_id');";
const Real = Date;
let agoraMs = new Real(2026, 10, 25, 14, 0, 0).getTime(); // quarta-feira, 25/11/2026, 14:00 (hora local)
class DataFixa extends Real {
  constructor(...a) { if (a.length === 0) super(agoraMs); else super(...a); }
  static now() { return agoraMs; }
}
const irPara = (ano, mes, dia, h, m) => { agoraMs = new Real(ano, mes - 1, dia, h || 0, m || 0, 0).getTime(); };
const quando = (ano, mes, dia, h, m) => new DataFixa(ano, mes - 1, dia, h || 0, m || 0, 0);

const fonte = fs.readFileSync(ARNES, 'utf8');
const fim = fonte.indexOf(MARCA);
if (fim === -1) { console.log('FALHA o arnês mudou: não achei ' + MARCA); process.exit(1); }
const av = new Function('require', '__dirname', 'Date', fonte.slice(0, fim) + '\nreturn function (__src) { return eval(__src); };')(require, __dirname, DataFixa);
av("AGENDAR_ULTIMO_PADRAO = '24s'"); // 14.20: esta suíte pede horários a semanas de distância; o padrão de quem nunca escolheu é uma semana
const logServidor = [];
console.error = (...a) => { logServidor.push(a.map(String).join(' ')); };
const CACHE = new Map();
const cacheObj = { get: k => (CACHE.has(k) ? CACHE.get(k) : null), getAll: ks => { const r = {}; (ks || []).forEach(k => { if (CACHE.has(k)) r[k] = CACHE.get(k); }); return r; },
  put: (k, v) => { CACHE.set(k, String(v)); }, putAll: o => { Object.keys(o || {}).forEach(k => CACHE.set(k, String(o[k]))); }, remove: k => { CACHE.delete(k); }, removeAll: ks => { (ks || []).forEach(k => CACHE.delete(k)); } };
global.CacheService = { getScriptCache: () => cacheObj };
global.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64')).map(x => (x > 127 ? x - 256 : x));
const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, sProf: sProf, EMAILS: EMAILS, PROPS: PROPS, TRAVA: TRAVA, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf })');
const S = nome => av(nome);
av('CONFIRMAR_ABRE_PADRAO = 100000'); // 14.26.1: esta suíte confirma a presença com muita antecedência (regra de antes); a janela de 48 horas é provada em backend_14_26_1.js
av('AGE_EMAIL_AUTOMATICO = true'); // 14.13: esta suíte confere o conteúdo dos e-mails pelo caminho de antes (envio na própria gravação); em produção a chave é false

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 500) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 600)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {}));
const pac = (sigla, acao, extra) => h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {}));
const novo = (nome, email) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); return s; };
const aba = nome => h.ctrl.getSheetByName(nome);
const cel = (nomeAba, id, col) => h.celula(aba(nomeAba), h.linhaDe(aba(nomeAba), 'id', id), col);
const linhas = nomeAba => (aba(nomeAba) ? aba(nomeAba).getLastRow() - 1 : -1);
const PER = { de: '2026-11-01', ate: '2027-02-08' };
const sessao = (sigla, d) => prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: uuid(), sigla: sigla, data: '2026-11-30', hora: '10:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: ['confirmacao', 'lembrete48', 'lembrete', 'cancelamento'] }, d || {}) });
const gatilho = d => { h.memo(); return S('enviarLembretes_')(d).sessoes; };
const pub = extra => h.post(Object.assign({ acao: 'confirmarSessaoPorLink' }, extra || {}));
const tokenDe = link => String(link).split('?confirmar=')[1];
const lida = id => prof('profLerAgenda', PER).sessoes.filter(x => x.id === id)[0];
const html = e => String(e.htmlBody || '');
const ligar = v => prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: v }, grade: [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', modalidade: 'ambas', ativo: 'sim' })) });

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');
ligar('Nao');

/* ---------------------------------------------------------------- L */
console.log('L. Link de confirmação (ação pública, token assinado)');
let idL, linkL;
tenta('L', () => {
  idL = uuid();
  sessao(P1, { id: idL, data: '2026-12-01', hora: '10:00', modalidade: 'online' });
  linkL = lida(idL).link_confirmar;
  ok('L1 a sessão agendada traz o link de confirmação, no endereço do site', linkL.indexOf(S('SITE_URL') + '?confirmar=') === 0 && tokenDe(linkL).split('.').length === 2, linkL.slice(0, 90));
  ok('L2 o token não carrega nome, e-mail nem telefone', (() => { const corpo = Buffer.from(tokenDe(linkL).split('.')[0], 'base64url').toString('utf8'); return corpo === 'conf|PROF_NP|' + idL; })());
  h.memo();
  let r = pub({ t: tokenDe(linkL) });
  ok('L3 abrir o link confirma a presença, sem crachá, e só devolve dia, hora, modalidade e onde é a sessão (14.5.1)', r.ok === true && r.ja_confirmada === false && r.data === '2026-12-01' && r.hora === '10:00' && r.modalidade === 'online' && JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['data', 'endereco', 'estado', 'hora', 'ja_confirmada', 'mapa', 'meet_link', 'modalidade', 'ok']) && cel('Sessoes', idL, 'confirmada_em') === '2026-11-25 14:00', r);
  ok('L4 a confirmação aparece para o profissional e para o paciente', lida(idL).confirmada === true && pac(P1, 'lerMinhasSessoes').sessoes.filter(x => x.id === idL)[0].confirmada === true);
  r = pub({ t: tokenDe(linkL) });
  ok('L5 abrir de novo: "já estava confirmada", sem regravar', r.ok === true && r.ja_confirmada === true && cel('Sessoes', idL, 'confirmada_em') === '2026-11-25 14:00', r);
  const t = tokenDe(linkL);
  const outra = uuid(); sessao(P2, { id: outra, data: '2026-12-01', hora: '11:00' });
  const tOutra = tokenDe(lida(outra).link_confirmar);
  const ruins = [t.slice(0, -1) + (t.slice(-1) === 'a' ? 'b' : 'a'), tOutra.split('.')[0] + '.' + t.split('.')[1], t.split('.')[0], '', 'x.y', t + 'a', Buffer.from('conf|PROF_NP|' + outra).toString('base64url') + '.' + '0'.repeat(32)];
  ok('L6 token adulterado, trocado entre sessões, sem assinatura ou inventado: recusado, e a outra sessão não é confirmada', ruins.every(x => { const q = pub({ t: x }); return q.ok === false && q.codigo === 'vencido' && q.erro === 'Este link não vale mais. Entre no COGNIATIVO para ver suas sessões.'; }) && cel('Sessoes', outra, 'confirmada_em') === '');
  ok('L7 o token do link não serve de crachá para nenhuma outra ação', ['lerMinhasSessoes', 'profLerAgenda', 'pacienteCancelarSessao', 'lerHistorico'].every(a => h.post({ acao: a, token: t, id: idL }).ok === false));
  prof('profCancelarSessao', { id: outra, opcoes: { quem: 'profissional' }, periodo: PER });
  ok('L8 sessão cancelada: o link dela vence', pub({ t: tOutra }).codigo === 'vencido' && cel('Sessoes', outra, 'confirmada_em') === '');
  const feita = uuid(); sessao(P2, { id: feita, data: '2026-12-02', hora: '09:00' });
  const tFeita = tokenDe(lida(feita).link_confirmar);
  prof('profMarcarSituacao', { id: feita, situacao: 'realizada', periodo: PER });
  ok('L9 sessão com situação marcada: link vencido, e a leitura não devolve mais o link', pub({ t: tFeita }).codigo === 'vencido' && lida(feita).link_confirmar === '');
  const passa = uuid(); sessao(P2, { id: passa, data: '2026-11-26', hora: '09:00' });
  const tPassa = tokenDe(lida(passa).link_confirmar);
  irPara(2026, 11, 26, 9, 0);
  ok('L10 sessão que já começou: link vencido', pub({ t: tPassa }).codigo === 'vencido');
  irPara(2026, 11, 26, 8, 59);
  ok('L11 um minuto antes do início ainda confirma', pub({ t: tPassa }).ok === true);
  irPara(2026, 11, 25, 14, 0);
  aba('Sessoes').getRange(h.linhaDe(aba('Sessoes'), 'id', passa), h.cab(aba('Sessoes')).indexOf('confirmada_em') + 1).setValue(''); // o relógio voltou: tira a confirmação "do futuro" para não confundir a ordem dos eventos
  h.memo();
  sessao(P1, { id: idL, data: '2026-12-03', hora: '10:00', modalidade: 'online' });
  ok('L12 remarcar derruba a confirmação; o mesmo link confirma a data nova', cel('Sessoes', idL, 'confirmada_em') === '' && (() => { const q = pub({ t: tokenDe(linkL) }); return q.ok && q.ja_confirmada === false && q.data === '2026-12-03'; })());
});

/* ---------------------------------------------------------------- E */
console.log('E. Eventos da agenda (sino e Início)');
tenta('E', () => {
  irPara(2026, 11, 25, 15, 0);
  const uAg = uuid(), idAg = 'ag-' + uAg; // 14.7: o paciente pede, o profissional aprova, a sessão nasce com este id
  pac(P2, 'pacienteAgendarSessao', { dados: { id: uAg, data: '2026-12-04', hora: '10:00' } });
  prof('profDecidirPedido', { id: uAg, aprovar: true, periodo: PER });
  irPara(2026, 11, 25, 15, 10);
  pac(P2, 'pacienteConfirmarSessao', { id: idAg });
  irPara(2026, 11, 25, 15, 20);
  const idPed = uuid();
  pac(P2, 'pacientePedirAgenda', { dados: { id: idPed, tipo: 'remarcar', sessao_id: idAg, data: '2026-12-07', hora: '10:00' } });
  irPara(2026, 11, 25, 15, 30);
  const idCanc = uuid(); sessao(P1, { id: idCanc, data: '2026-12-08', hora: '10:00' });
  pac(P1, 'pacienteCancelarSessao', { id: idCanc });
  const idProf = uuid(); sessao(P1, { id: idProf, data: '2026-12-09', hora: '10:00' });
  prof('profCancelarSessao', { id: idProf, opcoes: { quem: 'profissional' }, periodo: PER });
  let a = prof('profLerAgenda', PER);
  const E = a.eventos;
  ok('E1 eventos do mais novo ao mais antigo: cancelou, pediu remarcação, confirmou, pediu agendamento (14.7)', E.slice(0, 4).map(e => e.tipo + ' ' + e.sigla).join(' | ') === ['cancelou ' + P1, 'remarcar ' + P2, 'confirmou ' + P2, 'agendar ' + P2].join(' | ') && E[0].em === '2026-11-25 15:30' && E[0].nome === 'Paula Primeira' && E[0].data === '2026-12-08' && E[0].hora === '10:00' && E[1].data === '2026-12-07' && E[1].hora === '10:00', E.slice(0, 5)); // o pedido mostra o horário pedido
  ok('E2 confirmação pelo link também é evento', E.some(e => e.tipo === 'confirmou' && e.sigla === P1 && e.data === '2026-12-03'));
  ok('E3 o que o próprio profissional fez não vira evento (sessão criada, sessão cancelada por ele)', !E.some(e => e.data === '2026-12-09') && E.filter(e => e.tipo === 'agendar').length === 1 && E.filter(e => e.tipo === 'agendou').length === 0, E.filter(e => e.tipo === 'agendar' || e.tipo === 'agendou')); // 14.7: a sessão aprovada não vira "agendou"
  ok('E4 antes de "Marcar como vistos" não há marca', a.eventos_vistos_ate === '');
  irPara(2026, 11, 25, 15, 40);
  const v = prof('profMarcarEventosVistos', { periodo: PER });
  ok('E5 "Marcar como vistos" guarda o instante e os eventos continuam na lista', v.ok && v.agenda.eventos_vistos_ate === '2026-11-25 15:40' && v.agenda.eventos.length === E.length && v.agenda.eventos.every(e => e.em <= v.agenda.eventos_vistos_ate), v.agenda.eventos_vistos_ate);
  irPara(2026, 11, 25, 15, 50);
  pac(P1, 'pacienteConfirmarSessao', { id: idAg }); // de outro paciente: recusado, não gera evento
  const idN = uuid(); sessao(P1, { id: idN, data: '2026-12-10', hora: '10:00' });
  pac(P1, 'pacienteConfirmarSessao', { id: idN });
  a = prof('profLerAgenda', PER);
  ok('E6 evento novo depois de visto: é o único mais recente que a marca', a.eventos.filter(e => e.em > a.eventos_vistos_ate).length === 1 && a.eventos[0].tipo === 'confirmou' && a.eventos[0].data === '2026-12-10', a.eventos.slice(0, 2));
  h.memo();
  const lista = prof('profListarPacientes').pacientes;
  const l1 = lista.filter(p => p.sigla === P1)[0], l2 = lista.filter(p => p.sigla === P2)[0];
  ok('E7 os eventos vão na lista do login, por paciente (bloco do Início sem chamada nova)', l1.eventos_agenda.length >= 2 && l1.eventos_agenda[0].tipo === 'confirmou' && l2.eventos_agenda.some(e => e.tipo === 'remarcar') && l2.eventos_agenda.every(e => e.sigla === P2), [l1.eventos_agenda.length, l2.eventos_agenda.map(e => e.tipo)]);
  ok('E8 paciente não marca eventos como vistos', pac(P1, 'profMarcarEventosVistos', {}).ok === false);
  irPara(2026, 12, 26, 16, 0);
  a = prof('profLerAgenda', { de: '2026-12-20', ate: '2027-01-10' });
  ok('E9 passados 30 dias, os eventos saem da lista (fica só o aviso de pedido que venceu, do 14.28)', a.eventos.every(e => e.tipo === 'venceu'), a.eventos.map(e => e.tipo));
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- R */
console.log('R. Lembretes de 48 h e de 24 h');
tenta('R', () => {
  h.EMAILS.length = 0;
  irPara(2026, 12, 10, 9, 0); // quinta
  const longe = uuid(), meio = uuid(), perto = uuid(), semCaixa = uuid();
  sessao(P1, { id: longe, data: '2026-12-15', hora: '10:00', modalidade: 'online' });       // 121 h
  sessao(P2, { id: meio, data: '2026-12-11', hora: '15:00' });                              // 30 h
  sessao(P2, { id: perto, data: '2026-12-10', hora: '17:00' });                             // 8 h
  sessao(P1, { id: semCaixa, data: '2026-12-15', hora: '11:00', avisos: ['confirmacao'] });
  ok('R1 marcas ao nascer: a mais de 48 h, nenhuma; entre 48 e 24 h, o de 48 h dispensado; a menos de 24 h, os dois', cel('Sessoes', longe, 'lembrete48_em') === '' && cel('Sessoes', longe, 'ultimo_aviso_em') === '' && cel('Sessoes', meio, 'lembrete48_em') === 'dispensado' && cel('Sessoes', meio, 'ultimo_aviso_em') === '' && cel('Sessoes', perto, 'lembrete48_em') === 'dispensado' && cel('Sessoes', perto, 'ultimo_aviso_em') === 'dispensado', [cel('Sessoes', meio, 'lembrete48_em'), cel('Sessoes', perto, 'ultimo_aviso_em')]);
  let g = gatilho(quando(2026, 12, 13, 10, 5));
  ok('R2 com a chave desligada, o lembrete de 48 h que vence é contado e nada sai', g.desligados === 1 && g.enviados === 0 && h.EMAILS.length === 0 && cel('Sessoes', longe, 'lembrete48_em') === '', g);
  ligar('Sim');
  g = gatilho(quando(2026, 12, 13, 9, 55));
  ok('R3 a 48 h e 5 min ainda não sai', g.enviados === 0 && h.EMAILS.length === 0, g);
  g = gatilho(quando(2026, 12, 13, 10, 5));
  const e48 = h.EMAILS[0] || {};
  ok('R4 a menos de 48 h sai o primeiro lembrete: título, texto, botão "Confirmar presença" com o link e a linha sob o botão', g.enviados === 1 && h.EMAILS.length === 1 && e48.to === 'p1@exemplo.test' && e48.subject === 'Lembrete de sessão — COGNIATIVO' && html(e48).indexOf('Sua sessão é em dois dias') !== -1 && e48.body.indexOf('Lembrete da sua sessão com') !== -1 && e48.body.indexOf('terça, 15/12/2026, às 10:00 (On-line)') !== -1 && html(e48).indexOf('Confirmar presença') !== -1 && e48.body.indexOf('?confirmar=') !== -1 && e48.body.indexOf('Para remarcar ou cancelar, entre no COGNIATIVO com 24 horas ou mais de antecedência.') !== -1 && cel('Sessoes', longe, 'lembrete48_em') === '2026-12-13 10:05', [g, e48.subject, (e48.body || '').slice(0, 400)]);
  ok('R5 o link do e-mail é o da própria sessão', (() => { const m = /\?confirmar=([A-Za-z0-9_.-]+)/.exec(e48.body); return !!m && m[1] === tokenDe(lida(longe).link_confirmar); })());
  g = gatilho(quando(2026, 12, 13, 12, 0));
  ok('R6 segunda rodada não repete o de 48 h; a sessão sem a caixa não recebe', g.enviados === 0 && h.EMAILS.length === 1, g);
  h.EMAILS.length = 0;
  g = gatilho(quando(2026, 12, 14, 10, 5));
  const e24 = h.EMAILS[0] || {};
  ok('R7 a menos de 24 h sai o segundo lembrete, ainda com o botão de confirmar', g.enviados === 1 && html(e24).indexOf('Sua sessão está chegando') !== -1 && e24.body.indexOf('?confirmar=') !== -1 && e24.body.indexOf('já está confirmada') === -1 && cel('Sessoes', longe, 'ultimo_aviso_em') === '2026-12-14 10:05', [g, (e24.body || '').slice(0, 300)]);
  g = gatilho(quando(2026, 12, 14, 11, 0));
  ok('R8 e não repete', g.enviados === 0 && h.EMAILS.length === 1);
  // sessão entre 48 e 24 h ao nascer: só o de 24 h, e já confirmada
  h.EMAILS.length = 0;
  irPara(2026, 12, 10, 10, 0);
  pac(P2, 'pacienteConfirmarSessao', { id: meio });
  g = gatilho(quando(2026, 12, 10, 14, 0));
  ok('R9 sessão que nasceu entre 48 e 24 h não recebe o de 48 h', g.enviados === 0 && h.EMAILS.length === 0, g);
  g = gatilho(quando(2026, 12, 10, 15, 5));
  const eConf = h.EMAILS[0] || {};
  ok('R10 lembrete de 24 h de sessão já confirmada: avisa que está confirmada e não leva o link de confirmar', g.enviados === 1 && eConf.to === 'p2@exemplo.test' && eConf.body.indexOf('Sua presença já está confirmada.') !== -1 && eConf.body.indexOf('?confirmar=') === -1 && html(eConf).indexOf('Ver minhas sessões') !== -1 && html(eConf).indexOf('Confirmar presença') === -1, (eConf.body || '').slice(0, 400));
  h.EMAILS.length = 0;
  g = gatilho(quando(2026, 12, 10, 16, 0));
  ok('R11 sessão que nasceu a menos de 24 h não recebe lembrete nenhum', g.enviados === 0 && h.EMAILS.length === 0 && cel('Sessoes', perto, 'ultimo_aviso_em') === 'dispensado', g);
  // remarcar devolve os lembretes
  irPara(2026, 12, 14, 12, 0);
  sessao(P1, { id: longe, data: '2026-12-22', hora: '10:00', modalidade: 'online', avisos: ['lembrete48', 'lembrete'] });
  ok('R12 remarcar para longe zera as marcas: os dois lembretes voltam a valer', cel('Sessoes', longe, 'lembrete48_em') === '' && cel('Sessoes', longe, 'ultimo_aviso_em') === '');
  h.EMAILS.length = 0;
  g = gatilho(quando(2026, 12, 20, 11, 0));
  ok('R13 e o de 48 h sai de novo para a data nova', g.enviados === 1 && h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('22/12/2026') !== -1, g);
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- M */
console.log('M. Avisos na hora (automático e "Enviar e-mail agora")');
tenta('M', () => {
  irPara(2026, 11, 25, 14, 0);
  ligar('Nao');
  h.EMAILS.length = 0;
  const idM = uuid();
  let r = sessao(P1, { id: idM, data: '2026-12-16', hora: '14:00' });
  ok('M1 chave desligada: criar não manda e-mail e a resposta diz por quê', r.ok && r.aviso === 'desligado' && h.EMAILS.length === 0, r.aviso);
  r = prof('profAvisarSessao', { id: idM, dados: { tipo: 'confirmacao' } });
  const e = h.EMAILS[0] || {};
  ok('M2 "Enviar e-mail agora" manda mesmo com a chave desligada: confirmação com o botão de confirmar e o link', r.ok && r.enviado === true && r.motivo === '' && r.hora === '14:00' && h.EMAILS.length === 1 && e.to === 'p1@exemplo.test' && e.subject === 'Sessão agendada — COGNIATIVO' && html(e).indexOf('Confirmar presença') !== -1 && e.body.indexOf('?confirmar=') !== -1 && e.body.indexOf('quarta, 16/12/2026, às 14:00 (Presencial)') !== -1, [r, (e.body || '').slice(0, 300)]);
  h.EMAILS.length = 0;
  r = sessao(P1, { id: idM, data: '2026-12-17', hora: '15:00' });
  r = prof('profAvisarSessao', { id: idM, dados: { tipo: 'remarcacao', anterior: { data: '2026-12-16', hora: '14:00' } } });
  ok('M3 e-mail na hora da mudança: antes e depois', r.enviado === true && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Sessão remarcada — COGNIATIVO' && h.EMAILS[0].body.indexOf('passou de 16/12/2026 às 14:00 para 17/12/2026 às 15:00 (Presencial)') !== -1, h.EMAILS.map(x => x.body.slice(0, 200)));
  h.EMAILS.length = 0;
  r = prof('profCancelarSessao', { id: idM, opcoes: { quem: 'profissional', avisar: true }, periodo: PER });
  ok('M4 cancelar com a chave desligada: nada sai e a resposta diz "desligado"', r.ok && r.aviso === 'desligado' && h.EMAILS.length === 0, r.aviso);
  r = prof('profAvisarSessao', { id: idM, dados: { tipo: 'cancelamento' } });
  ok('M5 e-mail na hora do cancelamento (a sessão cancelada continua alcançável pelo id)', r.enviado === true && r.tipo === 'cancelamento' && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Sessão cancelada — COGNIATIVO', r);
  h.EMAILS.length = 0;
  r = prof('profAvisarSessao', { id: idM, dados: { tipo: 'confirmacao' } });
  ok('M6 sessão cancelada nunca recebe e-mail de confirmação: o tipo vira cancelamento', r.tipo === 'cancelamento' && h.EMAILS[0].subject === 'Sessão cancelada — COGNIATIVO', r);
  h.abaPac.getRange(h.linhaDe(h.abaPac, 'sigla', P2), h.cab(h.abaPac).indexOf('email') + 1).setValue(''); h.memo();
  const idS = uuid(); sessao(P2, { id: idS, data: '2026-12-18', hora: '10:00' });
  h.EMAILS.length = 0;
  r = prof('profAvisarSessao', { id: idS, dados: { tipo: 'confirmacao' } });
  ok('M7 paciente sem e-mail no cadastro: não envia e devolve o motivo', r.ok && r.enviado === false && r.motivo === 'sem_email' && h.EMAILS.length === 0, r);
  ok('M8 id que não existe, crachá de paciente ou sem crachá: recusado', prof('profAvisarSessao', { id: 'nao-existe-0001', dados: {} }).ok === false && pac(P1, 'profAvisarSessao', { id: idS, dados: {} }).ok === false && h.post({ acao: 'profAvisarSessao', id: idS }).ok === false);
  // automático com a chave ligada
  ligar('Sim');
  h.EMAILS.length = 0;
  const idA = uuid();
  r = sessao(P1, { id: idA, data: '2026-12-21', hora: '10:00' });
  ok('M9 chave ligada: criar manda a confirmação sozinho, com o link', r.aviso === '' && h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('?confirmar=') !== -1 && html(h.EMAILS[0]).indexOf('Confirmar presença') !== -1);
  h.EMAILS.length = 0;
  r = sessao(P1, { id: idA, data: '2026-12-21', hora: '11:00' });
  ok('M10 chave ligada: remarcar avisa sozinho (caixa "mudança ou cancelamento")', r.aviso === '' && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Sessão remarcada — COGNIATIVO', r.aviso);
  h.EMAILS.length = 0;
  r = sessao(P1, { id: idA, data: '2026-12-21', hora: '12:00', avisos: ['confirmacao', 'lembrete'] });
  ok('M11 sem a caixa de mudança marcada, remarcar não avisa e diz "caixa"', r.aviso === 'caixa' && h.EMAILS.length === 0, r.aviso);
  r = prof('profCancelarSessao', { id: idA, opcoes: { quem: 'profissional', avisar: false }, periodo: PER });
  ok('M12 cancelar com "avisar" desmarcado: não envia e diz "caixa"', r.ok && r.aviso === 'caixa' && h.EMAILS.length === 0, r.aviso);
  const idB = uuid(); sessao(P1, { id: idB, data: '2026-12-22', hora: '16:00' });
  h.EMAILS.length = 0;
  r = prof('profCancelarSessao', { id: idB, opcoes: { quem: 'profissional', avisar: true }, periodo: PER });
  ok('M13 cancelar com "avisar" marcado e a chave ligada: e-mail de cancelamento na hora', r.aviso === '' && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Sessão cancelada — COGNIATIVO');
  ligar('Nao');
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas, crachá e versão');
tenta('T', () => {
  ok('T1 da agenda, só a confirmação por link e a volta do Google (14.8.1, protegida pelo state assinado) são públicas; as três ações novas estão na trava', S('ACOES_PUBLICAS').join(',') === 'ping,autenticar,pedirRedefinicao,definirSenha,confirmarSessaoPorLink,concluirConexaoAgenda' && ['confirmarSessaoPorLink', 'profMarcarEventosVistos', 'profAvisarSessao'].every(a => S('ACOES_COM_TRAVA').indexOf(a) !== -1));
  h.TRAVA.ocupada = true;
  const r = pub({ t: tokenDe(linkL) });
  h.TRAVA.ocupada = false;
  ok('T2 com a trava ocupada a confirmação por link recusa ("ocupado") em vez de gravar', r.ok === false && r.codigo === 'ocupado', r);
  ok('T3 as quatro caixas de aviso e a coluna nova', S('AGENDA_AVISOS').join(',') === 'confirmacao,lembrete48,lembrete,cancelamento' && S('COLUNAS_SESSOES').indexOf('lembrete48_em') === 21 && h.cab(aba('Sessoes')).indexOf('lembrete48_em') !== -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T5 o servidor não registrou nenhum erro além da trava ocupada provocada', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
