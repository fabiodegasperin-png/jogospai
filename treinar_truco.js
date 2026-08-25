"use strict";
/* =========================================================
   treinar_truco.js — auto-jogo, torneio de personas e evolução.
   Roda: node treinar_truco.js
   Salva o DNA vencedor em truco_dna.json (o jogo lê de lá).
   ========================================================= */
const T = require("./truco_core.js");
const fs = require("fs");
const t0 = Date.now();

/* O DNA que esta valendo hoje — lido antes de qualquer coisa, porque o
   arquivo vai ser sobrescrito no fim. Sem isso a validacao comparava o
   campeao novo com o DNA PADRAO em vez do titular, e toda rodada de
   evolucao parecia um triunfo: medido em 25/08/2026, um campeao que
   ganhava "68.5% do atual" empatou 49.9% contra o que estava no jogo. */
const EM_USO = (()=>{
  try{ return JSON.parse(fs.readFileSync("truco_dna.json","utf8")).campeao || null; }
  catch(e){ return null; }
})();

const RAPIDO = 60;           // simulações por decisão durante o treino
const dna = (nome, mods) => Object.assign({ nome }, T.PADRAO, { sims: RAPIDO }, mods || {});

/* ---- as personas: cada uma é um jeito de encarar a aposta ---- */
const PERSONAS = [
  dna("atual",      {}),                                                   // o que está no ar hoje
  dna("agressivo",  { pedir:0.50, subir:0.58, blefe:0.34, freqPede:0.80,
                      margem:-0.12, mSaida:0.55, mPrimeira:0.85 }),
  dna("seguro",     { pedir:0.78, subir:0.85, blefe:0.04, freqPede:0.40,
                      margem:0.10, pagaPraVer:0.08 }),
  dna("estatistico",{ pedir:0.62, subir:0.68, blefe:0.00, freqPede:1.00,
                      margem:0.00, pagaPraVer:0.00,
                      mSaida:1, mPrimeira:1, mGanhouPrimeira:1, mSemCartas:1, mSemCartasExposto:1 }),
  dna("blefeiro",   { pedir:0.70, subir:0.80, blefe:0.50, blefeMin:0.10, blefeMax:0.55,
                      bl3:0.7, bl6:0.4, bl9:0.2 }),
  dna("pao-duro",   { pedir:0.88, subir:0.92, blefe:0.01, freqPede:0.30,
                      margem:0.20, pagaPraVer:0.02 })
];

/* ---- 1. torneio de todos contra todos ---- */
console.log("=== 1. TORNEIO DE PERSONAS (todos contra todos, 1x1) ===\n");
const PARTIDAS_RR = 240;
const pontos = {}; PERSONAS.forEach(p => pontos[p.nome] = { v:0, j:0 });
const grade = {};
for(let i=0;i<PERSONAS.length;i++){
  for(let j=i+1;j<PERSONAS.length;j++){
    const A = PERSONAS[i], B = PERSONAS[j];
    const r = T.duelo(A, B, { partidas: PARTIDAS_RR, n:2, semente: 100 + i*10 + j });
    grade[A.nome + " x " + B.nome] = r.taxaA;
    pontos[A.nome].v += r.taxaA * PARTIDAS_RR; pontos[A.nome].j += PARTIDAS_RR;
    pontos[B.nome].v += (1-r.taxaA) * PARTIDAS_RR; pontos[B.nome].j += PARTIDAS_RR;
    console.log(`  ${A.nome.padEnd(12)} x ${B.nome.padEnd(12)} -> ${(r.taxaA*100).toFixed(1)}% pro primeiro`);
  }
}
console.log("\n  classificação:");
const ranking = Object.entries(pontos).map(([n,o])=>({ n, taxa:o.v/o.j })).sort((a,b)=> b.taxa - a.taxa);
ranking.forEach((r,i) => console.log(`   ${i+1}. ${r.n.padEnd(12)} ${(r.taxa*100).toFixed(1)}%`));

/* ---- 2. evolução: mutar o campeão e só trocar se ganhar de verdade ---- */
console.log("\n=== 2. EVOLUÇÃO (mutação + seleção) ===\n");
const GERACOES = 14, FILHOS = 8, PARTIDAS_EV = 300;
const MARGEM_TROCA = 0.54;   // precisa ganhar 54% pra virar campeão (evita trocar por ruído)

let campeao = Object.assign({}, PERSONAS.find(p => p.nome === ranking[0].n));
campeao.nome = "campeao";
const trilha = [];
let sem = 5000;

for(let g=1; g<=GERACOES; g++){
  const forca = 0.28 * (1 - g/(GERACOES+4));     // muta forte no começo, fino no fim
  let melhor = null;
  for(let f=0; f<FILHOS; f++){
    const filho = T.muta(campeao, forca, T.semente(sem++));
    const r = T.duelo(filho, campeao, { partidas: PARTIDAS_EV, n:2, semente: sem++ });
    if(!melhor || r.taxaA > melhor.taxa) melhor = { dna: filho, taxa: r.taxaA };
  }
  const trocou = melhor.taxa >= MARGEM_TROCA;
  if(trocou) campeao = melhor.dna;
  trilha.push({ g, taxa: melhor.taxa, trocou });
  console.log(`  geração ${String(g).padStart(2)}: melhor filho ${(melhor.taxa*100).toFixed(1)}% ` +
              `${trocou ? "-> NOVO CAMPEÃO" : "(fica o campeão)"}`);
}

/* ---- 3. validação séria do campeão ---- */
console.log("\n=== 3. VALIDAÇÃO (amostra grande, sementes novas) ===\n");
const atual = dna("atual", {});
const titular = EM_USO ? dna("em uso", EM_USO) : atual;
console.log(EM_USO ? "  (comparando com o DNA que esta no jogo hoje)"
                   : "  (sem truco_dna.json: comparando com o DNA padrao)");
for(const n of [2,4]){
  const partidas = n === 2 ? 800 : 300;
  const r = T.duelo(campeao, titular, { partidas, n, semente: 999 + n });
  const erro = Math.sqrt(0.25/partidas) * 1.96 * 100;
  console.log(`  ${n===2?"1x1  ":"dupla"}: campeão vence ${(r.taxaA*100).toFixed(1)}% ` +
              `(±${erro.toFixed(1)} com 95% de confiança, ${partidas} partidas)`);
  console.log(`         pontos em mãos apostadas — campeão ${r.agg.ptsApostados[0]} x ${r.agg.ptsApostados[1]} titular`);
  console.log(`         pontos em mãos de 1     — campeão ${r.agg.ptsSimples[0]} x ${r.agg.ptsSimples[1]} titular`);
}

/* O veredito que faltava: o campeao so vale a troca se ganhar do titular. */
if(EM_USO){
  const r = T.duelo(campeao, titular, { partidas:800, n:2, semente:4242 });
  console.log(r.taxaA >= 0.53
    ? `
  >>> TROCAR: campeao vence o titular em ${(r.taxaA*100).toFixed(1)}% (800 partidas)`
    : `
  >>> NAO TROCAR: ${(r.taxaA*100).toFixed(1)}% contra o titular — dentro do ruido`);
}

/* ---- salva ----
   Grava assim que o campeao valida, e de novo no fim com o algoz. A etapa 4
   e longa: se ela cair, os 10 minutos de evolucao nao podem ir junto. */
const limpa = o => { const c = Object.assign({}, o); delete c.nome; delete c.sims; return c; };
function salva(algozDna){
  fs.writeFileSync("truco_dna.json", JSON.stringify({
    campeao: limpa(campeao),
    algoz: algozDna ? limpa(algozDna) : null,
    personas: PERSONAS.reduce((m,p)=> (m[p.nome] = limpa(p), m), {}),
    ranking, trilha, completo: !!algozDna,
    geradoEm: new Date().toISOString()
  }, null, 2));
  console.log("  [salvo em truco_dna.json" + (algozDna ? "" : " - campeao; falta o algoz") + "]");
}
salva(null);

/* ---- 4. e contra gente? o modelo do jogador real ---- */
console.log("\n=== 4. CONTRA O JEITO DO ROGÉRIO (corre de 68% dos trucos) ===\n");
const medroso = dna("medroso", { margem:0.38, pagaPraVer:0.02, pedir:0.76, blefe:0.03, freqPede:0.45 });
const base = T.duelo(atual,   medroso, { partidas:500, n:2, semente:31 });
const camp = T.duelo(campeao, medroso, { partidas:500, n:2, semente:31 });
console.log(`  bot atual  vence ${(base.taxaA*100).toFixed(1)}%`);
console.log(`  campeão    vence ${(camp.taxaA*100).toFixed(1)}%`);

// agora um DNA evoluído DE PROPÓSITO contra quem corre muito
let algoz = Object.assign({}, campeao); let sm = 7000;
for(let g=0; g<8; g++){
  let melhor = null;
  for(let f=0; f<6; f++){
    const filho = T.muta(algoz, 0.22, T.semente(sm++));
    const r = T.duelo(filho, medroso, { partidas:260, n:2, semente: sm++ });
    if(!melhor || r.taxaA > melhor.taxa) melhor = { dna: filho, taxa: r.taxaA };
  }
  const atualTaxa = T.duelo(algoz, medroso, { partidas:260, n:2, semente: sm++ }).taxaA;
  if(melhor.taxa > atualTaxa) algoz = melhor.dna;
}
const alg = T.duelo(algoz, medroso, { partidas:500, n:2, semente:31 });
console.log(`  algoz (treinado contra ele) vence ${(alg.taxaA*100).toFixed(1)}%`);
console.log(`\n  o que o algoz mudou pra explorar quem corre:`);
["pedir","freqPede","blefe","bl3","mSaida","mPrimeira","mGanhouPrimeira","subir"].forEach(k=>{
  const de = campeao[k], pra = algoz[k];
  if(Math.abs(pra-de) > 0.02) console.log(`    ${k.padEnd(16)} ${de.toFixed(2)} -> ${pra.toFixed(2)}`);
});

salva(algoz);
console.log(`\nSalvo em truco_dna.json — ${((Date.now()-t0)/1000).toFixed(1)}s`);
