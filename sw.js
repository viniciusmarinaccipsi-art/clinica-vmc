/**
 * Service Worker — Clínica VMC
 * ============================================================
 * Versão mínima para preparar o app como PWA.
 *
 * Nesta etapa, o service worker apenas se instala e ativa,
 * sem fazer cache agressivo. O cache real será adicionado
 * em etapas futuras, quando o conteúdo do app estiver
 * mais estável.
 *
 * Importante: o sistema clínico depende de chamadas em
 * tempo real ao Apps Script (login, gravação, leitura).
 * Por isso, NUNCA fazemos cache de chamadas para o domínio
 * do Apps Script — sempre vão direto para a rede.
 */

const CACHE_VERSAO = 'clinica-vmc-v1';

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

self.addEventListener('fetch', (event) => {
  // Por enquanto, apenas passa as requisições para a rede.
  // O cache será implementado quando a estrutura estiver estável.
  return;
});
