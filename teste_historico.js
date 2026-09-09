"use strict";
/* teste_historico.js — a leitura do log, com o codigo real do index.html.
   O numero que interessa: "quando podia matar, matou?" */
const fs = require("fs");
const TRUCO = require("./truco_core.js");
let n = 0, mal = 0;
const ok = (c, m) => { n++; if(!c){ mal++; console.log("  FALHOU:", m); } };

// extrai as funcoes de verdade da pagina, em vez de copiar a logica
const html = fs.readFileSync("index.html", "utf8");
const ini = html.indexOf("function leLog()");
const fim = html.indexOf("function abrirHistorico()");
const fonte = html.slice(ini, fim);

const guardado = { jogos_log: "[]" };
const localStorage = { getItem: k => guardado[k] || null,
                       setItem: (k,v) => { guardado[k] = v; } };
const JOGADOR = { id: "rogerio" };
const { leLog, analisaHistorico, contaVitorias, marcaVitoria, mesclaVitorias } =
  (new Function("TRUCO","localStorage","JOGADOR",
   fonte + "; return { leLog, analisaHistorico, contaVitorias, marcaVitoria, mesclaVitorias };"))(TRUCO, localStorage, JOGADOR);

const c = (r,s) => ({ r, s });
const ev = (tipo, extra) => Object.assign({ jogador:"rogerio", jogo:"truco", tipo }, extra);
// manilha = 5. forcas: 4=1 ... 12=7, 1=8, 2=9, 3=10, manilhas 11..14
guardado.jogos_log = JSON.stringify([
  // matou: joguei o 3 em cima do 7
  ev("jogou", { manilha:"5", estado:{ mesa:[c("3","P"), c("7","O")], mao:[c("6","O")] } }),
  // podia e nao matou: joguei o 4, tinha o 3 na mao contra o as
  ev("jogou", { manilha:"5", estado:{ mesa:[c("4","O"), c("1","C")], mao:[c("3","P")] } }),
  // nao podia: so tinha carta pequena
  ev("jogou", { manilha:"5", estado:{ mesa:[c("4","O"), c("1","C")], mao:[c("6","O")] } }),
  // eu abri a rodada: nao da pra julgar
  ev("jogou", { manilha:"5", estado:{ mesa:[c("4","O"), null], mao:[c("3","P")] } }),
  // evento antigo, sem estado
  ev("jogou", { manilha:"5" }),
  ev("pediu",  { quem:"voce" }), ev("pediu", { quem:"bot" }),
  ev("correu", { quem:"voce" }), ev("fim_mao", { vencedor:"p" }),
  ev("fim_partida", { vencedor:"p" }), ev("fim_partida", { vencedor:"b" }),
  ev("fim_partida", { vencedor:"p" }),
  // de outro jogador e de outro jogo: nao entram
  Object.assign(ev("jogou", { manilha:"5" }), { jogador:"fabio" }),
  Object.assign(ev("jogou", { manilha:"5" }), { jogo:"cacheta" })
]);

const r = analisaHistorico();
ok(r.podia === 2,     `oportunidades de matar = 2 (deu ${r.podia})`);
ok(r.matou === 1,     `matadas = 1 (deu ${r.matou})`);
ok(r.pediu === 1,     `so os pedidos SEUS contam (deu ${r.pediu})`);
ok(r.correu === 1,    `correu = 1 (deu ${r.correu})`);
ok(r.maos === 1,      `maos = 1 (deu ${r.maos})`);
ok(r.cartas === 5,    `cartas suas no truco = 5 (deu ${r.cartas})`);
ok(r.semEstado === 1, `1 evento antigo sem estado (deu ${r.semEstado})`);
ok(r.venceu === 2,    `partidas vencidas = 2 (deu ${r.venceu})`);
ok(r.perdeu === 1,    `partidas perdidas = 1 (deu ${r.perdeu})`);
ok(leLog().length === 14, "leLog devolve o log inteiro, sem filtrar");

/* ---- o contador de vitorias nao pode andar pra tras ----
   `gravaLog` descarta o evento mais velho quando o localStorage enche. Se o
   placar viesse de contar `fim_partida` no log, ele encolheria junto. */
const antes = contaVitorias("rogerio");
ok(antes.v === 2 && antes.d === 1, `semeou do log: 2V 1D (deu ${antes.v}V ${antes.d}D)`);

guardado.jogos_log = "[]";                       // localStorage encheu e podou tudo
const depois = contaVitorias("rogerio");
ok(depois.v === 2 && depois.d === 1, `log podado nao mexe no placar (deu ${depois.v}V ${depois.d}D)`);
ok(analisaHistorico().venceu === 2, "a tela de historico le o mesmo contador");

marcaVitoria(true); marcaVitoria(false);
const somou = contaVitorias("rogerio");
ok(somou.v === 3 && somou.d === 2, `marcaVitoria soma uma so vez (deu ${somou.v}V ${somou.d}D)`);

// jogador novo comeca zerado, sem herdar o do outro
ok(contaVitorias("ninguem").v === 0, "jogador sem partida comeca zerado");

/* ---- semear do servidor sem atropelar quem jogou offline ---- */
ok(mesclaVitorias({v:0,d:0}, {v:5,d:4}).v === 5,
   "aparelho zerado adota o placar do servidor");
ok(mesclaVitorias({v:5,d:4}, {v:5,d:4}).v === 5,
   "empatado, nao mexe");
const off = mesclaVitorias({v:6,d:4}, {v:5,d:4});
ok(off.v === 6 && off.d === 4,
   `partida jogada offline nao e apagada pelo servidor (deu ${off.v}V ${off.d}D)`);

console.log(`\n${n - mal}/${n} ok`);
process.exit(mal ? 1 : 0);
