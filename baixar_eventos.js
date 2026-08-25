"use strict";
/* baixar_eventos.js — copia local de TUDO que esta no Supabase.
   node baixar_eventos.js   ->  _eventos.json
   O servidor e quem guarda de verdade; isso aqui e o backup dele. */
const fs = require("fs");
const URL_ = "https://yvwfyhjhxbvxpcqejdsa.supabase.co/rest/v1/eventos";
const KEY = "sb_publishable_Xv7FzSBFEFozSc9EoEdGcg_WTtOltFp";
const H = { apikey:KEY, Authorization:"Bearer "+KEY };

process.chdir(__dirname);   // o agendador chama de outra pasta

(async () => {
  const tudo = [];
  for(let de = 0;; de += 1000){                  // o Supabase manda no maximo 1000 por vez
    const r = await fetch(URL_ + "?select=*&order=id.asc",
                          { headers: Object.assign({ Range: de + "-" + (de+999) }, H) });
    if(!r.ok) throw new Error("Supabase " + r.status + " " + await r.text());
    const p = await r.json();
    tudo.push(...p);
    process.stdout.write("\r" + tudo.length + " eventos...");
    if(p.length < 1000) break;
  }
  // so troca o arquivo se veio mais coisa: nunca substitui um backup por um menor
  const cru = fs.existsSync("_eventos.json") ? fs.readFileSync("_eventos.json","utf8") : "";
  const antes = cru ? JSON.parse(cru.slice(cru.indexOf("["))).length : 0;   // o arquivo antigo veio do PowerShell, com BOM
  if(tudo.length < antes) throw new Error(`servidor tem ${tudo.length}, o backup tem ${antes} — nao vou apagar`);
  fs.writeFileSync("_eventos.json", JSON.stringify(tudo, null, 1));
  return `${tudo.length} eventos (+${tudo.length - antes}), ultimo ${tudo[tudo.length-1].quando}`;
})().then(m => anota("ok      " + m), e => { anota("FALHOU  " + e.message); process.exit(1); });

// roda sozinho pelo agendador do Windows: se falhar calado, ninguem fica sabendo
function anota(msg){
  const l = new Date().toISOString().slice(0,16).replace("T"," ") + "  " + msg;
  console.log(l);
  fs.appendFileSync(__dirname + "/_backup.log", l + String.fromCharCode(10));
}
