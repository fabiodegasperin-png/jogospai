"use strict";
/* teste_fila.js — a promessa "não perde nenhum dado", com o codigo real do index.html.
   Sem internet, com servidor recusando, e com localStorage cheio. */
const fs = require("fs");
let n = 0, mal = 0;
const ok = (c, m) => { n++; if(!c){ mal++; console.log("  FALHOU:", m); } };
const tick = () => new Promise(r => setImmediate(r));

const html = fs.readFileSync("index.html", "utf8");
const corta = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const fonte = corta("function leLog()", "function analisaHistorico()") +
              corta("let SEQ = 0;", 'addEventListener("online"');

// localStorage de mentira, com teto de bytes pra forcar o estouro de cota
const guardado = { jogos_log: "[]" };
let TETO = 1e9;
const localStorage = {
  getItem: k => guardado[k] || null,
  setItem: (k, v) => {
    if(v.length > TETO){ const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; }
    guardado[k] = v;
  }
};
const lidos = () => JSON.parse(guardado.jogos_log);

// fetch de mentira: guarda o que subiu e obedece o roteiro
let rede = "off", subidas = [];
const fetch = (url, opt) => {
  if(rede === "off") return Promise.reject(new Error("offline"));
  const corpo = JSON.parse(opt.body);
  if(rede === "recusa") return Promise.resolve({ ok:false });
  subidas.push(corpo);
  return Promise.resolve({ ok:true });
};

const $ = () => ({ classList: { contains: () => false } });   // sempre truco
const T = { placar:[0,0], valor:1, n:2, dif:"medio", vazas:[], maos:[[]], mesa:[], vira:null };
const { reg, enviar } = (new Function("localStorage","fetch","$","T","G","JOGADOR","SB_URL","SB_KEY","SESSAO",
  fonte + "; return { reg, enviar };"))(localStorage, fetch, $, T, null,
  { id:"rogerio" }, "http://x", "k", "sess");

(async () => {
  // 1. internet caida: grava tudo, nao perde nada, nao marca como enviado
  reg("jogou", { carta:"3P" }); reg("pediu", { quem:"voce" }); reg("correu", { quem:"voce" });
  await tick();
  ok(lidos().length === 3, `3 eventos guardados offline (deu ${lidos().length})`);
  ok(lidos().every(e => e.ok === 0), "offline: nenhum evento se diz enviado");
  ok(lidos()[0].estado && lidos()[0].estado.placar, "o estado da mesa vai junto");
  ok(new Set(lidos().map(e => e.id)).size === 3, "cada evento tem id proprio");

  // 2. servidor recusa: continua na fila
  rede = "recusa"; enviar(); await tick();
  ok(lidos().every(e => e.ok === 0), "servidor recusou: a fila nao se apaga");

  // 3. internet volta: sobe a fila inteira de uma vez e so ai marca
  rede = "on"; enviar(); await tick();
  ok(subidas.length === 1 && subidas[0].length === 3, `os 3 atrasados sobem juntos (deu ${JSON.stringify(subidas.map(s=>s.length))})`);
  ok(lidos().every(e => e.ok === 1), "confirmado pelo servidor: marcado como enviado");
  ok(subidas[0][0].dados.t > 0, "o evento leva a hora em que aconteceu, nao a hora do envio");
  ok(subidas[0][0].dados.ok === undefined, "o controle da fila nao suja o servidor");

  // 4. evento antigo, de antes da fila, nao e reenviado
  guardado.jogos_log = JSON.stringify([{ t:1, jogador:"rogerio", jogo:"truco", tipo:"jogou" }]);
  subidas = []; enviar(); await tick();
  ok(subidas.length === 0, "evento antigo (sem ok) nao vira spam no servidor");

  // 5. localStorage cheio: sacrifica o velho JA SALVO, nunca o pendente
  guardado.jogos_log = JSON.stringify([
    { id:"a", t:1, tipo:"jogou", ok:1 },      // ja esta no servidor: pode sair
    { id:"b", t:2, tipo:"jogou", ok:1 },
    { id:"c", t:3, tipo:"jogou", ok:0 }       // pendente: intocavel
  ]);
  rede = "off";
  const tresEventos = guardado.jogos_log;
  reg("jogou", { carta:"7O" }); await tick();            // mede o tamanho de um evento de verdade
  TETO = guardado.jogos_log.length - 1;                  // teto: os 4 nao cabem, 3 cabem
  guardado.jogos_log = tresEventos;
  reg("jogou", { carta:"7O" }); await tick();
  const L = lidos(), ids = L.map(e => e.id);
  ok(!ids.includes("a"), "cheio: o mais velho ja confirmado foi descartado");
  ok(ids.includes("c"), "cheio: o pendente sobreviveu");
  ok(L[L.length-1].ok === 0, "cheio: o evento novo entrou mesmo assim");
  TETO = 1e9;

  console.log(`\n${n - mal}/${n} ok`);
  process.exit(mal ? 1 : 0);
})();
