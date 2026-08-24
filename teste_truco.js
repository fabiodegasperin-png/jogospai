"use strict";
/* teste_truco.js — cenário: última rodada, sou o último a jogar e tenho
   a folha que ganha a mão. Pedir é de graça: o bot TEM que pedir. */
const T = require("./truco_core.js");
let n = 0, mal = 0;
const ok = (c, m) => { n++; if(!c){ mal++; console.log("  FALHOU:", m); } };

function mesaGanhaCerta(){
  const vira = { r:"4", s:"O" };                 // manilha = 5
  const doAdversario = { r:"7", s:"E" };
  return {
    n:2, times:[0,1], manilha:T.manilhaDe(vira), vira,
    maos: [ [{ r:"5", s:"P" }], [] ],            // eu: zap. ele: já jogou tudo
    mesa: [ null, doAdversario ],
    vazas: ["p","b"],                            // 1x1: esta vaza decide a mão
    jogadas: [{r:"3",s:"P"},{r:"2",s:"C"},{r:"1",s:"O"},doAdversario],
    viradas: [[],[]],
    abreVaza: 1, ordem:[1,0], pos:1,
    valor: 1, pendente: null, ultimoPediu: null, parceiroAberto: false
  };
}
const P = Object.assign({}, T.PADRAO, { sims: 40 });

const E = mesaGanhaCerta();
ok(T.probMao(E, 0, P.sims, Math.random) > 0.99, "com o zap na última vaza a mão é ganha certa");
let pediu = 0;
for(let i=0;i<20;i++) if(T.querPedir(mesaGanhaCerta(), 0, P, Math.random)) pediu++;
ok(pediu === 20, `pede truco com ganho certo (pediu ${pediu}/20)`);

// e se veio truco em cima da mão ganha, sobe — nunca só aceita
const E2 = mesaGanhaCerta(); E2.valor = 1; E2.pendente = 3; E2.ultimoPediu = "b";
ok(T.responde(E2, 0, P, Math.random) === "subir", "sobe a aposta com ganho certo");

// e o contrário segue valendo: mão perdida não vira pedido automático
const E3 = mesaGanhaCerta();
E3.maos[0] = [{ r:"4", s:"O" }];                 // pior carta do baralho
ok(T.probMao(E3, 0, P.sims, Math.random) < 0.5, "mão perdida continua perdida");

// derrota certa: nunca paga pra ver, nem no nivel facil (pagaPraVer 0.30)
const facil = Object.assign({}, T.PADRAO, { sims:40, pagaPraVer:0.30, margem:-0.10 });
let pagou = 0;
for(let k=0;k<40;k++){
  const E4 = mesaGanhaCerta();
  E4.maos[0] = [{ r:"4", s:"O" }];               // perde da carta que ja esta na mesa
  E4.valor = 1; E4.pendente = 3; E4.ultimoPediu = "b";
  if(T.responde(E4, 0, facil, Math.random) !== "correr") pagou++;
}
ok(pagou === 0, "corre de truco com derrota certa (pagou pra ver " + pagou + "/40)");

/* ---- leitura: quem pediu truco tem carta ---- */
function maoDeSaida(){
  const vira = { r:"4", s:"O" };
  return {
    n:2, times:[0,1], manilha:T.manilhaDe(vira), vira,
    maos: [ [{r:"7",s:"E"},{r:"6",s:"C"},{r:"10",s:"O"}], [{},{},{}] ],  // mão fraca minha
    mesa: [null,null], vazas: [], jogadas: [], viradas: [[],[]],
    abreVaza: 0, ordem:[0,1], pos:0,
    valor: 1, pendente: 3, ultimoPediu: "b", parceiroAberto: false
  };
}
const surdo  = Object.assign({}, T.PADRAO, { sims:400, leitura:0 });
const atento = Object.assign({}, T.PADRAO, { sims:400, leitura:1 });
const pSurdo  = T.probMao(maoDeSaida(), 0, surdo,  T.semente(2));
const pAtento = T.probMao(maoDeSaida(), 0, atento, T.semente(2));
ok(pAtento < pSurdo - 0.03,
   `depois do truco deles a mão fraca vale menos (surdo ${pSurdo.toFixed(2)} -> atento ${pAtento.toFixed(2)})`);

/* ---- placar: correr que entrega a partida não é correr ---- */
const E5 = maoDeSaida();
E5.placar = [0, 11]; E5.alvo = 12;      // eles a 1 ponto: correr fecha o jogo deles
const seco = Object.assign({}, T.PADRAO, { sims:60, pagaPraVer:0, margem:0.25 });
ok(T.responde(E5, 0, seco, Math.random) !== "correr", "não corre quando correr entrega a partida");
const E6 = maoDeSaida(); E6.placar = [0,0]; E6.alvo = 12;
ok(T.responde(E6, 0, seco, Math.random) === "correr", "com placar folgado, mão fraca corre normal");

console.log(`\n${n - mal}/${n} ok`);
process.exit(mal ? 1 : 0);
