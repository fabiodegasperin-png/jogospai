"use strict";
/* =========================================================
   perfil_real.js — como a GENTE joga, medido nos eventos gravados.
   Substitui o chute que estava no comentario do treinador
   ("corre de 68% dos trucos"): o numero agora sai do log.

   node perfil_real.js            -> mostra a tabela
   require("./perfil_real.js")()  -> { jogadores, sessoes }
   ========================================================= */
/* roda nos dois lados: no node (treinador) e na pagina (<script src>).
   E a mesma conta nos dois — o jeito de nao ter duas versoes da verdade. */
(function(){   // fecha o escopo: na pagina isso e <script> solto, e "const TRUCO"
               // aqui em cima colidia com o TRUCO do truco_core.js
const emNode = typeof module !== "undefined" && !!module.exports;
const fs     = emNode ? require("fs") : null;
// na pagina o truco_core declara `const TRUCO`, que vive no escopo lexico
// global e NAO em globalThis — por isso a referencia e nua aqui
const CORE   = emNode ? require("./truco_core.js")
                      : (typeof TRUCO !== "undefined" ? TRUCO : null);

const ARQ = "_eventos.json";
const SEM_LOGIN = "(sem login)";

function le(arq){
  const cru = fs.readFileSync(arq || ARQ, "utf8");
  return JSON.parse(cru.slice(cru.indexOf("[")));      // o arquivo antigo veio com BOM
}

/* pediu com o que na mao? forca 11+ e manilha; 8,9,10 sao A,2,3.
   "fraco" = pediu sem manilha e sem figura alta: e o mais perto de blefe
   que da pra medir sem refazer a simulacao inteira. */
function pediuFraco(estado){
  if(!estado || !estado.vira || !(estado.mao || []).length) return null;
  const manilha = CORE.manilhaDe(estado.vira);
  const melhor = Math.max(...estado.mao.map(c => CORE.forca(c, manilha)));
  return melhor <= 7;
}

/* Os baldes onde o ponto cai. Foi o que respondeu "por que ele perde 2 pra 1
   ganhando 41% das maos", medido em 25/08/2026 nos 609 maos do Rogerio:

     mao simples ....... 320 maos   146 x 174    -28   joga carta BEM
     truco que pagou ... 156 maos   110 x 277   -167
     mao de onze .......  64 maos    27 x 165   -138   perde 84% delas

   -305 dos -337 dele saem das duas situacoes caras. Sem separar a mao de
   onze ela se escondia dentro de "sem aposta" e fazia parecer que ele
   perdia jogando carta — nao perde. */
const BALDES = ["semAposta","apostadaPaga","alguemCorreu","maoDeOnze"];
const balde = () => ({ maos:0, pro:0, contra:0 });
const zero = () => ({ maos:0, pontosPro:0, pontosContra:0,
                      respostas:0, correu:0, aceitou:0, subiu:0,
                      pedidos:0, pedidosFracos:0, botCorreu:0, botAceitou:0,
                      semAposta:balde(), apostadaPaga:balde(), alguemCorreu:balde(),
                      maoDeOnze:balde(),
                      /* fuga fatiada pela situacao: [correu, total] por valor em
                         jogo e por vaza. E o que responde "qual a melhor hora de
                         pedir seis" — quando tiver amostra. Medido em 25/08/2026
                         nao tinha: dos 226 trucos respondidos no log, 8 estavam
                         valendo 3 e nenhum valendo 6, porque o bot quase nunca
                         subia. Por isso a tabela existe zerada em vez de virar
                         um numero inventado. */
                      porValor:{}, porVaza:{} });
const conta2 = (m, k, correu) => { const c = m[k] = m[k] || [0,0]; c[correu ? 0 : 1]++; };

function perfilar(eventos){
  const E = (eventos || le()).filter(e => e.jogo === "truco")
              .sort((a,b) => a.id - b.id);            // id = ordem de insercao
  const jogadores = {}, sessoes = {};
  const esperandoResposta = {};                       // por sessao: o bot pediu, falta responder
  const naMao = {};                                   // por sessao: teve aposta? alguem correu?
  const pega = (m, k) => (m[k] = m[k] || zero());

  for(const e of E){
    const dados = e.dados || {};
    const quem = dados.quem, s = e.sessao;
    const j = dados.jogador || SEM_LOGIN;
    if(j === "teste") continue;
    const alvos = [pega(jogadores, j), pega(sessoes, s)];
    const soma = (k, v) => alvos.forEach(o => o[k] += (v === undefined ? 1 : v));

    if(e.tipo === "fim_mao"){
      soma("maos");
      const pts = dados.pontos || 0, meu = dados.vencedor === "p";
      soma(meu ? "pontosPro" : "pontosContra", pts);
      const m = naMao[s] || {};
      /* Mao de onze e a unica que ja nasce valendo 3 sem ninguem pedir nada.
         Detectada pela regra, nao pelo placar: o `placar` gravado nos eventos
         de 22-23/08 esta furado (aparece [10,18] numa partida que vai ate 12),
         entao confiar nele jogava metade das maos no balde errado.
         Ressalva honesta: mao cujo `pediu` se perdeu na rede (o bug de antes
         da fila) tambem cai aqui. Do log novo pra frente isso nao acontece. */
      const onze = pts === 3 && !m.apostou && !m.correu;
      const qual = onze ? "maoDeOnze"
                 : m.correu ? "alguemCorreu"
                 : m.apostou ? "apostadaPaga" : "semAposta";
      alvos.forEach(o => { o[qual].maos++; o[qual][meu ? "pro" : "contra"] += pts; });
      naMao[s] = {}; esperandoResposta[s] = false;
      continue;
    }
    naMao[s] = naMao[s] || {};
    if(e.tipo === "pediu") naMao[s].apostou = true;
    if(e.tipo === "correu") naMao[s].correu = true;
    if(e.tipo === "pediu" && quem === "bot"){
      const st = dados.estado || {};
      esperandoResposta[s] = { valor: st.valor || 1, vazas: (st.vazas || []).length };
      continue;
    }

    if(e.tipo === "pediu" && quem === "voce"){
      soma("pedidos");
      const fraco = pediuFraco(dados.estado);
      if(fraco) soma("pedidosFracos");
      // pedir em cima do pedido do bot tambem e uma resposta: nao correu
      if(esperandoResposta[s]){ soma("respostas"); soma("subiu"); esperandoResposta[s] = false; }
      continue;
    }
    if(e.tipo === "correu" || e.tipo === "aceitou"){
      const fugiu = e.tipo === "correu";
      if(quem === "voce"){
        const sit = esperandoResposta[s];
        if(sit){
          soma("respostas"); soma(fugiu ? "correu" : "aceitou");
          alvos.forEach(o => { conta2(o.porValor, sit.valor, fugiu);
                               conta2(o.porVaza,  sit.vazas, fugiu); });
        }
      }else{
        soma(fugiu ? "botCorreu" : "botAceitou");
      }
      esperandoResposta[s] = false;
    }
  }
  Object.values(jogadores).concat(Object.values(sessoes)).forEach(derivadas);
  return { jogadores, sessoes };
}

/* taxa so existe com amostra: abaixo de 6 e ruido, devolve null (o jogo ja
   usa esse mesmo piso em perfilDoAdversario) */
const taxa = (x, n) => n >= 6 ? x / n : null;
function derivadas(o){
  o.fuga       = taxa(o.correu, o.respostas);              // corre de quanto do truco do bot
  o.blefe      = taxa(o.pedidosFracos, o.pedidos);         // pede sem carta
  o.fugaDoBot  = taxa(o.botCorreu, o.botCorreu + o.botAceitou);
  o.pedePorMao = o.maos ? o.pedidos / o.maos : null;       // com que frequencia ele aposta
  BALDES.forEach(k => o[k].saldo = o[k].pro - o[k].contra);
  return o;
}

const pct = x => x === null ? "  —" : (100*x).toFixed(0).padStart(3) + "%";
function tabela(m, titulo){
  console.log("\n" + titulo);
  console.log("  " + "quem".padEnd(12) + "maos  resp  fuga  pede/mao  blefe   pontos");
  Object.entries(m).filter(([,o]) => o.maos >= 20)
    .sort((a,b) => b[1].maos - a[1].maos)
    .forEach(([k,o]) => console.log("  " + k.padEnd(12) +
      String(o.maos).padStart(4) + String(o.respostas).padStart(6) + "  " + pct(o.fuga) +
      "      " + (o.pedePorMao === null ? " — " : o.pedePorMao.toFixed(2)) +
      "  " + pct(o.blefe) + "   " + `${o.pontosPro} x ${o.pontosContra}`));
}

/* quando ele corre: a fuga fatiada. E daqui que sai a resposta pra "quando
   vale pedir seis" — o bot ja sabe a forca da mao dele sozinho (simula), o
   que ele NAO sabe e como voce responde em cada situacao. So imprime o que
   tem amostra: abaixo de 6 respostas e ruido, e ruido vira decisao errada. */
function quandoCorre(m){
  Object.entries(m).filter(([,o]) => o.respostas >= 6)
    .sort((a,b) => b[1].respostas - a[1].respostas)
    .forEach(([k,o]) => {
      console.log("");
      console.log("  " + k + " — de que truco ele corre (fuga geral " + pct(o.fuga) + "):");
      const linha = (rot, c) => console.log("    " + rot.padEnd(18) +
        String(c[0]+c[1]).padStart(4) + " trucos   corre " +
        (c[0]+c[1] >= 6 ? pct(c[0]/(c[0]+c[1])) : "  — (amostra curta)"));
      Object.keys(o.porValor).sort((a,b)=>a-b).forEach(v => linha("valendo " + v, o.porValor[v]));
      Object.keys(o.porVaza).sort((a,b)=>a-b).forEach(v => linha("apos " + v + " vaza(s)", o.porVaza[v]));
    });
}

/* onde o ponto cai: e a tabela que explica placar sem falar de sorte */
function onde(m){
  Object.entries(m).filter(([,o]) => o.maos >= 50)
    .sort((a,b) => b[1].maos - a[1].maos)
    .forEach(([k,o]) => {
      console.log("");
      console.log("  " + k + " — onde os pontos vao:");
      [["mao simples","semAposta"],["truco que pagou","apostadaPaga"],
       ["alguem correu","alguemCorreu"],["mao de onze","maoDeOnze"]]
        .forEach(([rot,c]) => o[c].maos && console.log("    " + rot.padEnd(16) +
          String(o[c].maos).padStart(4) + " maos   " +
          String(o[c].pro).padStart(4) + " x " + String(o[c].contra).padEnd(4) +
          "  saldo " + (o[c].saldo > 0 ? "+" : "") + o[c].saldo));
    });
}

if(emNode){
  module.exports = perfilar;
  module.exports.le = le;
  module.exports.pediuFraco = pediuFraco;
  if(require.main === module){
    const r = perfilar();
    tabela(r.jogadores, "POR JOGADOR (quem esta logado)");
    tabela(r.sessoes,   "POR SESSAO (cada visita a mesa — o login nem sempre e trocado)");
    console.log("");
    console.log("  fuga = corre de quanto dos trucos do bot | blefe = pediu sem manilha nem A/2/3");
    onde(r.jogadores);
    quandoCorre(r.jogadores);
  }
}else{
  globalThis.PERFIL = perfilar;   // a pagina usa a mesma conta do treinador
  globalThis.PERFIL.pediuFraco = pediuFraco;
}
})();
