/* Pacote 14.10 — apoio das suítes: lê a mensagem que o servidor entrega ao Gmail (users.messages.send, campo `raw`)
   e devolve no formato que as provas já usam para o MailApp ({ to, subject, body, htmlBody, name }), mais o endereço
   de quem envia (`de`), se o logo foi embutido (`logo`) e os anexos (`anexos`). Não é uma suíte: não roda sozinho. */
'use strict';

function decodificar(raw) {
  const mime = Buffer.from(String(raw).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const cab = mime.split('\r\n\r\n')[0];
  const palavra = v => String(v || '').replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
  const linha = n => { const m = new RegExp('^' + n + ': (.*)$', 'mi').exec(cab); return m ? m[1].trim() : ''; };
  const mDe = /^(.*) <([^>]+)>$/.exec(linha('From')) || [null, '', linha('From')];
  const saida = { to: linha('To'), subject: palavra(linha('Subject')), name: palavra(mDe[1]), de: mDe[2], body: '', htmlBody: '', logo: false, anexos: [], mime: mime,
    cabecalhos: cab.split('\r\n').filter(l => /^[A-Za-z-]+: /.test(l)).map(l => l.split(':')[0]) };
  const re = /Content-Type: ([^\r\n]+)\r\nContent-Transfer-Encoding: base64\r\n((?:[^\r\n]+\r\n)*)\r\n([A-Za-z0-9+\/=\r\n]*?)\r\n--/g;
  let m;
  while ((m = re.exec(mime))) {
    const tipo = m[1], extras = m[2], b64 = m[3].replace(/\s+/g, '');
    const longa = m[3].split('\r\n').some(l => l.length > 76);
    if (longa) saida.linhaLonga = true;
    if (tipo.indexOf('text/plain') === 0) saida.body = Buffer.from(b64, 'base64').toString('utf8');
    else if (tipo.indexOf('text/html') === 0) saida.htmlBody = Buffer.from(b64, 'base64').toString('utf8');
    else if (tipo.indexOf('image/png') === 0) saida.logo = /Content-ID: <logo>/.test(extras) && b64.length > 100;
    else saida.anexos.push({ tipo: tipo.split(';')[0], nome: (/filename="([^"]+)"/.exec(extras) || [])[1] || '', texto: Buffer.from(b64, 'base64').toString('utf8') });
  }
  return saida;
}

/**
 * Google de mentira para o envio: devolve um `fetch` que atende a renovação do acesso (token) e o envio do Gmail,
 * guardando cada mensagem em `caixa` já decodificada; o resto vai para `outro` (o fetch que a suíte já tinha).
 * `o.recusar()` verdadeiro faz o Gmail responder 403 (permissão retirada).
 */
function fetchComGmail(caixa, outro, o) {
  const resp = (codigo, dados) => ({ getResponseCode: () => codigo, getContentText: () => JSON.stringify(dados === undefined ? {} : dados) });
  return (url, op) => {
    const u = String(url);
    if (u === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') {
      const bearer = String((op && op.headers && op.headers.Authorization) || '').replace(/^Bearer /, '');
      if (!bearer) return resp(401, {});
      if (o && o.recusar && o.recusar(bearer)) return resp(403, { error: { status: 'PERMISSION_DENIED' } });
      const msg = decodificar(JSON.parse(op.payload).raw);
      msg.bearer = bearer;
      caixa.push(msg);
      return resp(200, { id: 'm' + caixa.length, labelIds: ['SENT'] });
    }
    if (outro) return outro(url, op);
    if (u === 'https://oauth2.googleapis.com/token') return resp(200, { access_token: 'at-' + String((op.payload || {}).refresh_token || ''), expires_in: 3600 });
    return resp(200, {});
  };
}

module.exports = { decodificar: decodificar, fetchComGmail: fetchComGmail };
