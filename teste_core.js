const CAC = require("./cacheta_core.js");
const c = (r,s)=>({r,s});
const J = ()=>({r:"★",s:""});
let n=0, mal=0;
const ok = (cond,msg)=>{ n++; if(!cond){ mal++; console.log("  FALHOU:", msg); } };

/* ---- ehJogo ---- */
ok(CAC.ehJogo([c("5","♥"),c("6","♥"),c("7","♥")]), "sequência 3");
ok(CAC.ehJogo([c("Q","♠"),c("K","♠"),c("A","♠")]), "Q K A (ás alto)");
ok(CAC.ehJogo([c("A","♠"),c("2","♠"),c("3","♠")]), "A 2 3 (ás baixo)");
ok(!CAC.ehJogo([c("5","♥"),c("6","♠"),c("7","♥")]), "naipe misturado não é sequência");
ok(!CAC.ehJogo([c("K","♠"),c("A","♠"),c("2","♠")]), "não dá a volta K A 2");
ok(CAC.ehJogo([c("9","♥"),c("9","♠"),c("9","♣")]), "trinca");
ok(CAC.ehJogo([c("9","♥"),c("9","♥"),c("9","♣")]), "2 baralhos: naipe repetido vale");
ok(CAC.ehJogo([c("9","♥"),c("9","♠"),c("9","♣"),c("9","♦")]), "quadra");
ok(CAC.ehJogo([c("9","♥"),c("9","♠"),c("9","♣"),c("9","♦"),c("9","♥")]), "quina");
ok(!CAC.ehJogo([c("9","♥"),c("9","♠"),c("9","♣"),c("9","♦"),c("9","♥"),c("9","♠")]), "6 iguais não é jogo");
ok(CAC.ehJogo([c("2","♠"),c("3","♠"),c("4","♠"),c("5","♠")]), "sequência de 4");
ok(CAC.ehJogo([c("7","♥"),c("8","♥"),c("9","♥"),c("10","♥"),c("J","♥")]), "sequência de 5");
ok(!CAC.ehJogo([c("5","♥"),c("6","♥")]), "2 cartas não é jogo");

/* ---- coringa ---- */
ok(CAC.ehJogo([c("9","♥"),J(),c("9","♣")]), "trinca com coringa");
ok(CAC.ehJogo([c("5","♥"),J(),c("7","♥")]), "coringa tapa buraco de 1");
ok(!CAC.ehJogo([c("5","♥"),J(),c("9","♥")]), "coringa não tapa buraco de 2");
ok(CAC.ehJogo([J(),J(),c("2","♦")]), "2 coringas + 1 carta");
ok(CAC.ehJogo([c("5","♥"),c("6","♥"),J(),J()]), "sequência de 4 com 2 coringas");
ok(!CAC.ehJogo([c("5","♥"),c("6","♠"),J()]), "coringa não junta naipes diferentes");

/* ---- fecha: o bug que eu tinha ---- */
const tresTrincas = [c("9","♥"),c("9","♠"),c("9","♣"),c("5","♥"),c("6","♥"),c("7","♥"),
                     c("Q","♠"),c("K","♠"),c("A","♠")];
ok(CAC.fecha(tresTrincas), "3 jogos de 3");
const quadraMaisCinco = [c("K","♠"),c("K","♥"),c("K","♦"),c("K","♣"),
                         c("7","♥"),c("8","♥"),c("9","♥"),c("10","♥"),c("J","♥")];
ok(CAC.fecha(quadraMaisCinco), "quadra + sequência de 5 (antes falhava)");
const quatroMaisCinco = [c("2","♠"),c("3","♠"),c("4","♠"),c("5","♠"),
                         c("7","♥"),c("8","♥"),c("9","♥"),c("10","♥"),c("J","♥")];
ok(CAC.fecha(quatroMaisCinco), "sequência 4 + sequência 5 (antes falhava)");
const noveSeguidas = [c("2","♦"),c("3","♦"),c("4","♦"),c("5","♦"),c("6","♦"),
                      c("7","♦"),c("8","♦"),c("9","♦"),c("10","♦")];
ok(CAC.fecha(noveSeguidas), "sequência de 9");
const aberta = [c("9","♥"),c("9","♠"),c("9","♣"),c("5","♥"),c("6","♥"),c("7","♥"),
                c("Q","♠"),c("K","♠"),c("2","♦")];
ok(!CAC.fecha(aberta), "mão aberta não fecha");

/* ---- falta / maxCob ---- */
ok(CAC.falta(tresTrincas) === 0, "mão pronta: falta 0");
ok(CAC.falta(quadraMaisCinco) === 0, "quadra+5: falta 0");
ok(CAC.falta(aberta) === 1, "falta 1 na mão aberta (trocar o 2♦), deu " + CAC.falta(aberta));

/* ---- bater ---- */
const dez = tresTrincas.concat([c("2","♦")]);
ok(CAC.indiceParaBater(dez) === 9, "descarta o 2♦ e bate");
ok(CAC.indiceParaBater(aberta.concat([c("3","♦")])) === -1, "não dá pra bater");

/* ---- a conta do vou/corro ---- */
ok(CAC.evIr(0.60, 10) > 0, "10 pontos e 60% de chance: vai");
ok(CAC.evIr(0.40, 10) < 0, "10 pontos e 40% de chance: corre");
ok(Math.abs(CAC.evIr(0.50, 10)) < 1e-9, "com muitos pontos o ponto de virada é 50%");
ok(CAC.evIr(0.05, 1) > 0, "com 1 ponto sempre vai (correr mata igual)");
ok(CAC.evIr(0.60, 2) < 0, "com 2 pontos, 60% não basta");

/* ---- baralho ---- */
const b = CAC.novoBaralho();
ok(b.length === 108, "108 cartas");
ok(b.filter(CAC.ehCoringa).length === 4, "4 coringas");

/* ---- semente reproduz ---- */
const r1 = CAC.simularPartida({n:6, rnd:CAC.semente(99)});
const r2 = CAC.simularPartida({n:6, rnd:CAC.semente(99)});
ok(JSON.stringify(r1) === JSON.stringify(r2), "mesma semente = mesma partida");

/* ---- partidas terminam ---- */
let terminou = 0;
for(let i=0;i<40;i++){
  const r = CAC.simularPartida({n: 6 + (i%5), rnd: CAC.semente(1000+i)});
  if(r.campeao >= 0 && r.rodadas < 400) terminou++;
}
ok(terminou === 40, "40 partidas terminaram com campeão, deu " + terminou);

console.log(`\n${n-mal}/${n} testes passaram`);
process.exit(mal ? 1 : 0);
