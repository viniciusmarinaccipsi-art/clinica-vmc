/**
 * Service Worker — Clínica VMC
 * ============================================================
 * Versão mínima para preparar o app como PWA.
 *
 * Pacote 12.7.3 (21/04/2026):
 * - Removido handler 'fetch' no-op (evita warning no Chrome
 *   "Fetch event handler is recognized as no-op").
 * - Bump de versão do cache (v1 -> v2) para invalidar caches
 *   antigos automaticamente quando este SW for ativado.
 *
 * Importante: o sistema clínico depende de chamadas em
 * tempo real ao Apps Script (login, gravação, leitura).
 * NUNCA faremos cache de chamadas para o domínio do
 * Apps Script — sempre vão direto para a rede.
 *
 * Os dados dos pacientes (anamnese, automonitoramento,
 * escalas) NÃO passam por este service worker — ficam
 * 100% no Google Sheets via Apps Script.
 */

const CACHE_VERSAO = 'clinica-vmc-v2';

self.addEventListener('install', (event) => {
  // Ativa o novo SW imediatamente, sem esperar abas antigas fecharem
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpa caches antigos de versões anteriores
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_VERSAO)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

// Pacote 12.7.3: handler 'fetch' removido.
// Sem cache implementado, a presença de um listener vazio
// adicionava overhead em toda navegação. O navegador agora
// faz as requisições diretamente, como se o SW não existisse
// para fetches — mas mantém a estrutura PWA para o futuro.
