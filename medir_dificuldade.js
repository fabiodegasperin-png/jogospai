"use strict";
/* =========================================================
   medir_dificuldade.js — os niveis do jogo contra os jogadores de verdade.
   Le o DIF direto do index.html (nao copia: o que roda na mesa e o que e
   medido aqui) e as personas calibradas do truco_dna.json.
   node medir_dificuldade.js [partidas]
   ========================================================= */
const fs = require("fs");
const TRUCO = require("./truco_core.js");

const PARTIDAS = Number(process.argv[2]) || 150;

// pega CAMPEAO e DIF da pagina, do jeito que estao la
const html = fs.readFileSync("index.html", "utf8");
// vai ate depois do DIF_NOME pra pegar tambem a ordem e os nomes dos degraus:
// assim um nivel novo aparece aqui sozinho, sem ninguem lembrar de atualizar
const fonte = html.slice(html.indexOf("const CAMPEAO"), html.indexOf("let dificuldade"));
const { CAMPEAO, DIF, DIF_ORDEM, DIF_NOME } =
  (new Function("TRUCO", fonte + "; return { CAMPEAO, DIF, DIF_ORDEM, DIF_NOME };"))(TRUCO);

const DNA = JSON.parse(fs.readFileSync("truco_dna.json", "utf8"));
const alvos = Object.entries(DNA.algozes || {})
  .filter(([,a]) => a.persona).sort((a,b) => b[1].medido.maos - a[1].medido.maos);

if(!alvos.length){ console.log("sem personas em truco_dna.json — rode node treinar_truco.js"); process.exit(1); }

const erro = Math.sqrt(0.25/PARTIDAS) * 1.96 * 100;
console.log(`Quanto cada nivel ganha de cada jogador (${PARTIDAS} partidas, ±${erro.toFixed(1)})`);
console.log("");
console.log("  " + "jogador".padEnd(13) + "maos   " +
            DIF_ORDEM.map(n => DIF_NOME[n].padStart(8)).join("") + "   fuga medida");

for(const [nome, a] of alvos){
  const p = Object.assign({ nome:"real" }, a.persona, { sims:60 });
  const linha = DIF_ORDEM.map(niv => {
    const r = TRUCO.duelo(Object.assign({ nome:niv }, DIF[niv]), p,
                          { partidas:PARTIDAS, n:2, semente:31 });
    return (r.taxaA*100).toFixed(1).padStart(7) + "%";
  });
  console.log("  " + nome.padEnd(13) + String(a.medido.maos).padStart(4) + "   " +
              linha.join("") + "     " + (a.medido.fuga*100).toFixed(0) + "%");
}
console.log("");
console.log("  50% = jogo parelho. A mesa abre no degrau que o perfil do jogador pede.");
