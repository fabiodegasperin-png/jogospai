"use strict";
/* teste_dificuldade.js — a escada de niveis, com o codigo real do index.html.
   O que quebraria calado: um degrau em DIF_ORDEM sem DNA ou sem nome (o botao
   cicla pra "undefined"), e o automatico mandando alguem pro nivel errado. */
const fs = require("fs");
const TRUCO = require("./truco_core.js");
let n = 0, mal = 0;
const ok = (c, m) => { n++; if(!c){ mal++; console.log("  FALHOU:", m); } };

const html = fs.readFileSync("index.html", "utf8");
const fonte = html.slice(html.indexOf("const CAMPEAO"), html.indexOf("function paramsDoBot"));
const { DIF, DIF_ORDEM, DIF_NOME, nivelPara } =
  (new Function("TRUCO", fonte + "; return { DIF, DIF_ORDEM, DIF_NOME, nivelPara };"))(TRUCO);

// 1. a escada esta inteira: ciclar nao pode cair em buraco
DIF_ORDEM.forEach(k => {
  ok(!!DIF[k],      `o nivel "${k}" tem DNA`);
  ok(!!DIF_NOME[k], `o nivel "${k}" tem nome na tela`);
});
ok(Object.keys(DIF).length === DIF_ORDEM.length, "nao ha nivel orfao fora da ordem");

// 2. a escada sobe: mais sims e menos erro a cada degrau
for(let i = 1; i < DIF_ORDEM.length; i++){
  const a = DIF[DIF_ORDEM[i-1]], b = DIF[DIF_ORDEM[i]];
  ok(b.sims  >  a.sims,  `${DIF_ORDEM[i]} pensa mais que ${DIF_ORDEM[i-1]}`);
  ok(b.erro  <= a.erro,  `${DIF_ORDEM[i]} erra menos que ${DIF_ORDEM[i-1]}`);
  ok(b.blefe <= a.blefe, `${DIF_ORDEM[i]} blefa menos que ${DIF_ORDEM[i-1]}`);
}

// 3. o automatico: quem corre pouco apanha e precisa de bot mais fraco.
//    Os tres primeiros sao os jogadores medidos no log em 25/08/2026.
[[0.00, "facil",  "quem paga todo truco"],
 [0.25, "meio",   "Rogério"],
 [0.73, "normal", "Fábio"],
 [0.14, "facil",  "logo abaixo do corte do facil"],
 [0.15, "meio",   "logo acima do corte do facil"],
 [0.99, "normal", "quem corre de tudo ainda para no Forte"],
 [null, "normal", "sem histórico"]
].forEach(([fuga, esperado, quem]) =>
  ok(nivelPara(fuga) === esperado,
     `${quem} (fuga ${fuga}) -> ${esperado}, veio ${nivelPara(fuga)}`));

// o automatico nunca manda ninguem pro topo sozinho: e escolha do jogador
ok(![0, 0.3, 0.5, 0.8, 1].some(f => nivelPara(f) === "dificil"),
   "o automatico nao chega no Difícil sozinho");

console.log(`\n${n - mal}/${n} ok`);
process.exit(mal ? 1 : 0);
