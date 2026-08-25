"use strict";
/* teste_perfil.js — a leitura do log de verdade.
   O que se mede aqui: uma resposta ao truco so conta se veio DEPOIS de um
   pedido do bot, e subir tambem e resposta (nao e fuga). */
const perfilar = require("./perfil_real.js");
let n = 0, mal = 0;
const ok = (c, m) => { n++; if(!c){ mal++; console.log("  FALHOU:", m); } };

let id = 0;
const ev = (tipo, dados) => ({ id:++id, sessao:"s1", jogo:"truco",
                               dados: Object.assign({ jogador:"ze" }, dados||{}), tipo });
const carta = (r,s) => ({ r, s });

const r = perfilar([
  // 1) bot pede, humano corre
  ev("pediu",   { quem:"bot", aposta:3 }), ev("correu", { quem:"voce", valia:1 }),
  ev("fim_mao", { vencedor:"b", pontos:1 }),
  // 2) bot pede, humano aceita
  ev("pediu",   { quem:"bot" }), ev("aceitou", { quem:"voce" }),
  ev("fim_mao", { vencedor:"p", pontos:3 }),
  // 3) bot pede, humano SOBE: e resposta, e nao e fuga
  ev("pediu",   { quem:"bot" }),
  ev("pediu",   { quem:"voce", estado:{ vira:carta("4","O"), mao:[carta("5","P")] } }),   // 5 e manilha: mao forte
  ev("aceitou", { quem:"bot" }), ev("fim_mao", { vencedor:"p", pontos:6 }),
  // 4) humano pede do nada, com lixo: conta como pedido fraco, nao como resposta
  ev("pediu",   { quem:"voce", estado:{ vira:carta("4","O"), mao:[carta("6","O"), carta("7","C")] } }),
  ev("correu",  { quem:"bot", valia:1 }), ev("fim_mao", { vencedor:"p", pontos:1 }),
  // 5) aceitar sem ninguem ter pedido (evento perdido no meio): nao inventa resposta
  ev("aceitou", { quem:"voce" }), ev("fim_mao", { vencedor:"b", pontos:1 }),
  // 6) de outro jogo: fora
  Object.assign(ev("fim_mao", { vencedor:"p", pontos:9 }), { jogo:"cacheta" })
]);
const z = r.jogadores.ze;

ok(z.respostas === 3,      `3 respostas ao truco do bot (deu ${z.respostas})`);
ok(z.correu === 1,         `correu 1 (deu ${z.correu})`);
ok(z.aceitou === 1,        `aceitou 1 (deu ${z.aceitou})`);
ok(z.subiu === 1,          `subiu 1 (deu ${z.subiu})`);
ok(z.pedidos === 2,        `pediu 2 vezes ao todo (deu ${z.pedidos})`);
ok(z.pedidosFracos === 1,  `so 1 dos pedidos foi com lixo (deu ${z.pedidosFracos})`);
ok(z.maos === 5,           `5 maos, cacheta fora (deu ${z.maos})`);
ok(z.pontosPro === 10 && z.pontosContra === 2,
   `pontos 10 x 2 (deu ${z.pontosPro} x ${z.pontosContra})`);
ok(z.botCorreu === 1 && z.botAceitou === 1, "as respostas do bot contam separado");
// amostra pequena: 3 respostas nao viram taxa
ok(z.fuga === null,        "menos de 6 respostas: fuga fica null, nao inventa taxa");

// com amostra, a taxa aparece
const muitos = [];
for(let i=0;i<10;i++){
  muitos.push(ev("pediu", { quem:"bot" }), ev(i < 3 ? "correu" : "aceitou", { quem:"voce" }),
              ev("fim_mao", { vencedor:"p", pontos:1 }));
}
const g = perfilar(muitos).jogadores.ze;
ok(Math.abs(g.fuga - 0.3) < 1e-9, `fuga 30% com amostra (deu ${g.fuga})`);
ok(Math.abs(g.pedePorMao - 0) < 1e-9, `nao pediu nenhuma vez (deu ${g.pedePorMao})`);

console.log(`\n${n - mal}/${n} ok`);
process.exit(mal ? 1 : 0);
