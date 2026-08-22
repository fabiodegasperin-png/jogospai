const CAC = require("./cacheta_core.js");
const fs = require("fs");
const t0 = Date.now();

console.log("Treinando (self-play com exploração)...");
const { tabela, hist } = CAC.treinar({ partidas: 500, n: 8, iteracoes: 4, explora: 0.20 });
hist.forEach(h => console.log(`  iteração ${h.iteracao}: ${h.chaves} situações, ${h.amostras} amostras`));

console.log("\nTabela aprendida — chance de ganhar QUANDO VAI:");
console.log("falta | jáForam | mesa |  n   | vitória | decisão(10pts)");
Object.keys(tabela).sort().forEach(k => {
  const e = tabela[k];
  if(e.ida < CAC.MIN_AMOSTRA) return;
  const [f, jf, m] = k.split("|");
  const p = e.vit/e.ida;
  const vai = CAC.evIr(p, 10) > 0 ? "IR" : "correr";
  console.log(`  ${f}   |    ${jf}    |  ${m}   | ${String(e.ida).padStart(5)} |  ${(p*100).toFixed(1).padStart(5)}% | ${vai}`);
});

console.log("\nAfinando pesos de compra/descarte...");
const { pol, trilha } = CAC.otimizar({ passos: 14, partidas: 100, n: 8, tab: tabela });
trilha.filter(t => t.passo > 0).forEach(t =>
  console.log(`  ${t.aceito ? "ACEITO " : "recusa "} ${t.mexeu}=${t.valor}  cand ${t.perdaCand.toFixed(3)} vs campeão ${t.perdaCampeao.toFixed(3)}`));
console.log("  política final:", JSON.stringify(pol));

console.log("\nValendo: bot treinado (cadeira 0) contra o bot antigo:");
const antigo = Object.assign({}, CAC.POL_PADRAO);
const a = CAC.avaliar(pol, antigo, { partidas: 400, n: 8, tab: tabela });
console.log(`  vitórias do treinado: ${(a.taxaVitoriaA*100).toFixed(1)}%  (1 em 8 = 12.5% seria empate)`);
console.log(`  pontos perdidos por rodada — treinado ${a.perdaPorRodadaA.toFixed(3)} | antigo ${a.perdaPorRodadaB.toFixed(3)}`);

const semTabela = CAC.avaliar(pol, pol, { partidas: 300, n: 8, tab: null });
console.log(`\n  referência sem tabela (todo mundo igual): ${semTabela.perdaPorRodadaA.toFixed(3)} por rodada`);

fs.writeFileSync("cacheta_tabela.json", JSON.stringify({ tabela, pol, geradoEm: new Date().toISOString() }));
console.log(`\nSalvo em cacheta_tabela.json — ${((Date.now()-t0)/1000).toFixed(1)}s`);
