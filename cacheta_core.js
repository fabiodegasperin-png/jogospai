/* =====================================================================
   cacheta_core.js — motor da Cacheta (regras da casa do Rogério)

   Sem DOM: serve tanto o jogo (jogos.html) quanto o treinador (treino.html).
   Regras: 2 baralhos (108 cartas, 4 coringas), 6 a 10 jogadores, cada um por si.
   Declaração vou/corro na ordem (dealer fala por último e é obrigado se
   ninguém foi). Pontos: começa com 10, corre −1, bate 0, foi e perdeu −2,
   piso em zero. Recompra no ato de zerar com a pontuação do último vivo.
   ===================================================================== */
"use strict";
var CAC = (function(){

/* ---------------------------------------------------------------- cartas */
const ORDEM  = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const NAIPES = ["♦","♠","♥","♣"];
const JOKER  = "★";
const ci = c => ORDEM.indexOf(c.r) + 1;                 // A=1 ... K=13
const ehCoringa = c => c.r === JOKER;
const rot = c => ehCoringa(c) ? "★" : c.r + c.s;        // rótulo curto

function novoBaralho(){
  const d = [];
  for(let k=0;k<2;k++){
    ORDEM.forEach(r => NAIPES.forEach(s => d.push({r,s})));
    d.push({r:JOKER,s:""},{r:JOKER,s:""});
  }
  return d;                                             // 108 cartas
}
// xorshift: self-play reproduzível (mesma semente = mesma partida)
function semente(n){
  let s = (n>>>0) || 1;
  return () => { s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; };
}
function embaralhar(a, rnd){
  rnd = rnd || Math.random;
  for(let i=a.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function ordenar(m){
  m.sort((a,b)=> (ehCoringa(a)-ehCoringa(b))
              || NAIPES.indexOf(a.s)-NAIPES.indexOf(b.s)
              || ci(a)-ci(b));
  return m;
}

/* ----------------------------------------------------------------- jogos */
/* Um "jogo" é trinca/quadra/quina (mesmo número) ou sequência (mesmo naipe),
   de 3 cartas OU MAIS. Coringa vale qualquer carta e pode ter mais de um. */
function ehJogo(g){
  const n = g.length;
  if(n < 3) return false;
  const nat = g.filter(c => !ehCoringa(c));
  if(!nat.length) return true;                          // só coringa
  // mesmo número — com 2 baralhos o naipe pode repetir. Máximo quina (5).
  if(n <= 5 && nat.every(c => c.r === nat[0].r)) return true;
  // sequência: mesmo naipe, valores distintos, cabendo numa janela de n
  if(!nat.every(c => c.s === nat[0].s)) return false;
  const cabe = vs => {
    if(new Set(vs).size !== vs.length) return false;
    const lo = Math.min(...vs), hi = Math.max(...vs);
    return Math.max(1, hi-n+1) <= Math.min(lo, 15-n);   // janela existe em 1..14
  };
  const vals = nat.map(ci);
  if(cabe(vals)) return true;
  return vals.includes(1) && cabe(vals.map(v => v===1 ? 14 : v));  // Ás alto (Q K A)
}

const _memoF = new Map(), _memoC = new Map();
// ponytail: teto simples no cache — esvazia inteiro em vez de LRU.
// Numa mão de 9 cartas o custo de recalcular é microssegundos.
const TETO = 300000;
const guarda = (m,k,v)=>{ if(m.size > TETO) m.clear(); m.set(k,v); return v; };
const chaveMao = cs => cs.map(rot).sort().join(",");

/* Enumera todo subconjunto que forma um jogo, como bitmask, e resolve por
   programação dinâmica. A versão anterior recursava sobre máscaras E sobre o
   resto (3^n) e derrubava o self-play; esta é 2^n uma vez + DP linear nos jogos. */
const _memoJ = new Map();
const canon = cs => cs.slice().sort((x,y)=> rot(x) < rot(y) ? -1 : rot(x) > rot(y) ? 1 : 0);
const pop = m => { let c=0; while(m){ m &= m-1; c++; } return c; };

function jogosPossiveis(cs){                   // cs já canônico
  const k = chaveMao(cs);
  const v = _memoJ.get(k); if(v !== undefined) return v;
  const n = cs.length, out = [];
  for(let m=1; m<(1<<n); m++){
    if(pop(m) < 3) continue;
    const g = [];
    for(let i=0;i<n;i++) if((m>>i)&1) g.push(cs[i]);
    if(ehJogo(g)) out.push(m);
  }
  return guarda(_memoJ, k, out);
}

/* as cartas se dividem inteiras em jogos? (partição exata) */
function fecha(cs){
  if(!cs.length) return true;
  if(cs.length < 3) return false;
  const k = chaveMao(cs);
  const v = _memoF.get(k); if(v !== undefined) return v;
  const c = canon(cs), n = c.length, js = jogosPossiveis(c);
  const memo = new Int8Array(1<<n).fill(-1);
  const dp = mask => {
    if(mask === 0) return 1;
    if(memo[mask] >= 0) return memo[mask];
    const low = mask & -mask;
    let r = 0;
    for(let i=0;i<js.length;i++){
      const M = js[i];
      if((M & low) && (M & mask) === M && dp(mask ^ M)){ r = 1; break; }
    }
    memo[mask] = r; return r;
  };
  return guarda(_memoF, k, !!dp((1<<n)-1));
}

/* maior número de cartas cobertas por jogos disjuntos (0..n) */
function maxCob(cs){
  if(cs.length < 3) return 0;
  const k = chaveMao(cs);
  const v = _memoC.get(k); if(v !== undefined) return v;
  const c = canon(cs), n = c.length, js = jogosPossiveis(c);
  const memo = new Int16Array(1<<n).fill(-1);
  const dp = mask => {
    if(mask === 0) return 0;
    if(memo[mask] >= 0) return memo[mask];
    const low = mask & -mask;
    let melhor = dp(mask ^ low);                 // essa carta fica de fora
    for(let i=0;i<js.length;i++){
      const M = js[i];
      if((M & low) && (M & mask) === M) melhor = Math.max(melhor, pop(M) + dp(mask ^ M));
    }
    memo[mask] = melhor; return melhor;
  };
  return guarda(_memoC, k, dp((1<<n)-1));
}

/* Igual ao maxCob, mas devolve QUAIS jogos formam a melhor partição.
   Serve pra organizar a mão do jogador: trinca junto com trinca. */
function melhorParticao(cs){
  if(cs.length < 3) return { cob:0, grupos:[] };
  const c = canon(cs), n = c.length, js = jogosPossiveis(c);
  const memo = new Map();
  const dp = mask => {
    if(mask === 0) return { cob:0, masks:[] };
    if(memo.has(mask)) return memo.get(mask);
    const low = mask & -mask;
    let melhor = dp(mask ^ low);
    for(let i=0;i<js.length;i++){
      const M = js[i];
      if((M & low) && (M & mask) === M){
        const r = dp(mask ^ M);
        if(pop(M) + r.cob > melhor.cob)
          melhor = { cob: pop(M) + r.cob, masks: [M].concat(r.masks) };
      }
    }
    memo.set(mask, melhor);
    return melhor;
  };
  const r = dp((1<<n)-1);
  return { cob: r.cob, grupos: r.masks.map(M => c.filter((_,i)=>(M>>i)&1)) };
}

/* Ordem "de mesa": jogos fechados primeiro, depois pares e quase-sequências,
   depois cartas soltas, coringa sempre na ponta direita. */
function organizarMao(mao){
  // o coringa entra na busca de jogos: senão uma mão fechada COM coringa
  // não aparecia fechada. Só o coringa que sobra vai pra direita.
  const { grupos } = melhorParticao(mao);
  const usados = new Set(), saida = [];
  grupos.forEach(g => { ordenar(g); g.forEach(c => { usados.add(c); saida.push(c); }); });

  const cor   = mao.filter(c => !usados.has(c) && ehCoringa(c));
  const sobra = mao.filter(c => !usados.has(c) && !ehCoringa(c));
  const feito = new Set(), blocos = [];
  sobra.forEach(c => {
    if(feito.has(c)) return;
    const bloco = [c]; feito.add(c);
    sobra.forEach(d => {
      if(feito.has(d)) return;
      const mesmoNumero = d.r === c.r;
      const quaseSeq = d.s === c.s && Math.abs(ci(d) - ci(c)) <= 2;
      if(mesmoNumero || quaseSeq){ bloco.push(d); feito.add(d); }
    });
    blocos.push(bloco);
  });
  blocos.sort((a,b) => b.length - a.length || ci(a[0]) - ci(b[0]));
  blocos.forEach(b => { ordenar(b); b.forEach(c => saida.push(c)); });
  return saida.concat(cor);
}

/* Como a mão deve aparecer na tela: blocos na ORDEM em que o jogador
   deixou as cartas. Ler a ordem dele (e não recalcular a melhor divisão)
   é o que faz o arraste continuar valendo — se ele junta uma quadra na
   mão, o bloco se forma e ganha etiqueta sozinho. */
function tipoDoJogo(g){
  const nat = g.filter(c => !ehCoringa(c));
  if(!nat.length) return "Coringas";
  if(nat.every(c => c.r === nat[0].r))
    return g.length === 3 ? "Trinca" : g.length === 4 ? "Quadra" : "Quina";
  return "Sequência";
}
function gruposVisiveis(mao){
  const grupos = [];
  const comecaJogo = i => {                      // maior jogo que começa aqui
    for(let t = Math.min(5, mao.length - i); t >= 3; t--)
      if(ehJogo(mao.slice(i, i+t))) return t;
    return 0;
  };
  let soltas = [];
  const despeja = () => { if(soltas.length){ grupos.push({ cartas: soltas, tipo: null }); soltas = []; } };
  for(let i = 0; i < mao.length; ){
    const t = comecaJogo(i);
    if(t){
      despeja();
      const g = mao.slice(i, i+t);
      grupos.push({ cartas: g, tipo: tipoDoJogo(g) });
      i += t;
    }else{ soltas.push(mao[i]); i++; }
  }
  despeja();
  return grupos;
}

/* combinações de tamanho k dos índices 0..n-1 */
function combinacoes(n, k){
  const out = [], atual = [];
  (function anda(i){
    if(atual.length === k){ out.push(atual.slice()); return; }
    for(let j=i;j<n;j++){ atual.push(j); anda(j+1); atual.pop(); }
  })(0);
  return out;
}

const _memoD = new Map();
/* Quantas cartas precisam ser TROCADAS pra mão fechar (0 = mão pronta, 1 = a
   uma carta de bater). É a conta que o jogador faz de cabeça.

   Antes eu testava toda combinação de descarte chamando fecha() — 3,1 ms por
   mão, 30x mais caro que todo o resto junto, e era isso que inviabilizava o
   self-play. Agora: pra cada subconjunto, quantos curingas o transformam num
   jogo; depois uma DP sobre (cartas restantes, curingas gastos). */
function falta(mao){
  const key = chaveMao(mao);
  const v = _memoD.get(key); if(v !== undefined) return v;
  const n = mao.length, WMAX = Math.min(n, 6), TAM = 1<<n;

  const validX = new Int32Array(TAM);            // bit x = "S + x curingas é jogo"
  for(let S=1; S<TAM; S++){
    let jk = 0, m = 0;
    const nat = [];
    for(let i=0;i<n;i++) if((S>>i)&1){ const c = mao[i]; if(ehCoringa(c)) jk++; else { nat.push(c); m++; } }
    let mesmoR = true, mesmoN = true;
    for(let i=1;i<m;i++){
      if(nat[i].r !== nat[0].r) mesmoR = false;
      if(nat[i].s !== nat[0].s) mesmoN = false;
    }
    let vals = null, valsA = null, repetido = false;
    if(m && mesmoN){
      vals = nat.map(ci);
      const vis = new Set(vals); repetido = vis.size !== vals.length;
      if(vals.indexOf(1) >= 0) valsA = vals.map(x => x===1 ? 14 : x);
    }
    const janela = (vv, size)=>{
      let lo = vv[0], hi = vv[0];
      for(let i=1;i<vv.length;i++){ if(vv[i]<lo) lo=vv[i]; if(vv[i]>hi) hi=vv[i]; }
      return Math.max(1, hi-size+1) <= Math.min(lo, 15-size);
    };
    let bits = 0;
    for(let x=0; x<=WMAX; x++){
      const size = m + jk + x;
      if(size < 3) continue;
      let bom = false;
      if(m === 0) bom = true;
      else if(size <= 5 && mesmoR) bom = true;
      else if(mesmoN && !repetido) bom = janela(vals, size) || (valsA && janela(valsA, size));
      if(bom) bits |= (1<<x);
    }
    validX[S] = bits;
  }

  // R[mask][w]: as cartas de mask mais w curingas se dividem em jogos?
  const R = new Int8Array(TAM*(WMAX+1)).fill(-1);
  const resolve = (mask, w)=>{
    if(mask === 0) return (w === 0 || w >= 3) ? 1 : 0;   // curinga puro só em grupo de 3+
    const at = mask*(WMAX+1) + w;
    if(R[at] >= 0) return R[at];
    R[at] = 0;                                          // corta ciclo (não há, mas é barato)
    const low = mask & -mask, semLow = mask ^ low;
    let sub = semLow;
    while(true){
      const S = sub | low, bits = validX[S];
      if(bits){
        const resto = mask ^ S;
        for(let x=0; x<=w; x++)
          if((bits>>x)&1 && resolve(resto, w-x)){ R[at] = 1; return 1; }
      }
      if(sub === 0) break;
      sub = (sub-1) & semLow;
    }
    return R[at];
  };

  let res = WMAX + 1;
  busca:
  for(let d=0; d<=WMAX; d++){
    for(let mask=0; mask<TAM; mask++){
      if(pop(mask) !== n-d) continue;
      if(resolve(mask, d)){ res = d; break busca; }
    }
  }
  return guarda(_memoD, key, res);
}

/* qual carta descartar pra bater; −1 se não dá */
function indiceParaBater(mao){
  for(let i=0;i<mao.length;i++)
    if(fecha(mao.filter((_,k)=>k!==i))) return i;
  return -1;
}

/* ------------------------------------------------------------- política */
/* Todo o "jeito de jogar" cabe nestes números. É isso que o self-play afina. */
const POL_PADRAO = {
  pesoCobExtra: 0,   // reservado; a régua fina (falta) só roda na declaracao
  pesoCob: 10,       // valor de cada carta já encaixada num jogo
  pesoCoringa: 6,    // valor de segurar coringa
  pesoPar: 1,        // valor de par / quase-sequência
  ganhoLixo: 1,      // ganho mínimo pra pegar do lixo em vez do monte
  perigo: 3,         // o quanto evita descartar carta que o adversário quer
  ruidoDecl: 0,      // 0..1 — chance de decidir no chute (nível fácil)
  ruidoDesc: 0       // ruído no descarte
};

/* ponytail: usa maxCob (barato), NÃO falta(). `falta` faz busca sobre
   combinações e é chamada ~10x por descarte — em self-play isso estourou
   a memória. Aqui a régua grossa basta; a exata só na hora de declarar. */
function pontuar(cs, pol){
  pol = pol || POL_PADRAO;
  let p = maxCob(cs)*pol.pesoCob
        + cs.filter(ehCoringa).length*pol.pesoCoringa;
  const nat = cs.filter(c=>!ehCoringa(c));
  for(let i=0;i<nat.length;i++) for(let j=i+1;j<nat.length;j++){
    const a=nat[i], b=nat[j];
    if(a.r===b.r) p += pol.pesoPar;
    else if(a.s===b.s && Math.abs(ci(a)-ci(b))<=2 && ci(a)!==ci(b)) p += pol.pesoPar;
  }
  return p;
}

/* ---- a conta que decide vou/corro ----
   Correr custa 1 ponto garantido. Ir custa 0 se ganhar, 2 se perder.
   Como o placar trava em zero, zerar precisa valer menos que "0 pontos",
   senão com 2 pontos o bot acha que perder é de graça.                    */
const valorPts = x => x === 0 ? -3 : x;          // ponytail: zerar dói mais que o placar diz
function evIr(p, pts){
  const sePerde = Math.max(0, pts-2), seCorre = Math.max(0, pts-1);
  return (p*valorPts(pts) + (1-p)*valorPts(sePerde)) - valorPts(seCorre);
}

/* chave da tabela aprendida: o que realmente muda a chance de ganhar */
const chaveDecl = (f, jaForam, nMesa) =>
  Math.min(6, f) + "|" + Math.min(3, jaForam) + "|" + (nMesa >= 8 ? "G" : "P");

/* palpite inicial, usado enquanto a tabela não existe ou tem pouco dado */
function probEstimada(f, jaForam){
  const q = [0.95,0.70,0.45,0.28,0.16,0.09,0.05,0.03,0.02,0.01][Math.min(9, Math.max(0, f))];
  return Math.max(0.01, Math.min(0.97, q/(1 + 0.9*jaForam)));
}
const MIN_AMOSTRA = 40;                          // abaixo disso a tabela não manda

function probIr(ctx, tab){
  const t = tab && tab[chaveDecl(ctx.falta, ctx.jaForam, ctx.nMesa)];
  if(t && t.ida >= MIN_AMOSTRA) return t.vit/t.ida;
  return probEstimada(ctx.falta, ctx.jaForam);
}
function decidirIr(ctx, pol, tab, rnd){
  if(ctx.obrigado) return true;
  rnd = rnd || Math.random;
  pol = pol || POL_PADRAO;
  if(pol.ruidoDecl && rnd() < pol.ruidoDecl) return rnd() < 0.5;
  return evIr(probIr(ctx, tab), ctx.pts) > 0;
}

/* Nota de desempenho: avaliar "qual carta jogo fora" pedia maxCob de 10 mãos
   diferentes, e cada chamada re-enumerava os jogos possíveis do zero (512
   testes cada). Aqui os jogos são enumerados UMA vez sobre a mão inteira e a
   mesma DP responde às 10 perguntas. Foi isso que fez o self-play caber. */
function notaSemCada(cs, pol){
  pol = pol || POL_PADRAO;
  const n = cs.length, js = [];
  for(let m=1; m<(1<<n); m++){
    if(pop(m) < 3) continue;
    const g = [];
    for(let i=0;i<n;i++) if((m>>i)&1) g.push(cs[i]);
    if(ehJogo(g)) js.push(m);
  }
  const memo = new Int16Array(1<<n).fill(-1);
  const dp = mask => {
    if(mask === 0) return 0;
    if(memo[mask] >= 0) return memo[mask];
    const low = mask & -mask;
    let melhor = dp(mask ^ low);
    for(let i=0;i<js.length;i++){
      const M = js[i];
      if((M & low) && (M & mask) === M) melhor = Math.max(melhor, pop(M) + dp(mask ^ M));
    }
    memo[mask] = melhor; return melhor;
  };
  const full = (1<<n)-1, nCor = cs.filter(ehCoringa).length, out = [];
  for(let i=0;i<n;i++){
    let s = dp(full ^ (1<<i))*pol.pesoCob
          + (nCor - (ehCoringa(cs[i]) ? 1 : 0))*pol.pesoCoringa;
    for(let a=0;a<n;a++){
      if(a === i || ehCoringa(cs[a])) continue;
      for(let b=a+1;b<n;b++){
        if(b === i || ehCoringa(cs[b])) continue;
        const x = cs[a], y = cs[b];
        if(x.r === y.r) s += pol.pesoPar;
        else if(x.s === y.s && Math.abs(ci(x)-ci(y)) <= 2 && ci(x) !== ci(y)) s += pol.pesoPar;
      }
    }
    out.push(s);
  }
  return out;
}

function pegarDoLixo(mao, topo, pol){
  pol = pol || POL_PADRAO;
  const notas = notaSemCada(mao.concat([topo]), pol);
  return Math.max.apply(null, notas) - pontuar(mao, pol) >= pol.ganhoLixo;
}
function escolherDescarte(mao, pol, perigo, rnd){
  pol = pol || POL_PADRAO; rnd = rnd || Math.random;
  const notas = notaSemCada(mao, pol);
  let bi = 0, bs = -Infinity;
  for(let i=0;i<mao.length;i++){
    const c = mao[i];
    let s = notas[i];
    if(perigo && (perigo.has(c.r) || perigo.has(c.s))) s -= pol.perigo;   // não alimenta o adversário
    if(pol.ruidoDesc) s += rnd()*pol.ruidoDesc;
    if(s > bs){ bs = s; bi = i; }
  }
  return bi;
}

/* ------------------------------------------------------------ simulação */
function repor(deck, lixo, rnd){
  if(deck.length || !lixo.length) return;
  const topo = lixo.pop();
  embaralhar(lixo, rnd);
  while(lixo.length) deck.push(lixo.pop());
  if(topo) lixo.push(topo);
}

/* joga uma rodada inteira sobre `est`; devolve o vencedor (ou null se anulou) */
function simularRodada(est, cfg){
  const rnd = cfg.rnd, tab = cfg.tab, pols = cfg.pols;
  const N = est.jog.length;
  const baralho = embaralhar(novoBaralho(), rnd);
  est.jog.forEach(j=>{ if(!j.fora){ j.mao = baralho.splice(0,9); j.foi = null; } });
  const deck = baralho, lixo = [deck.pop()];

  const ordem = [];
  for(let k=1;k<=N;k++){ const j = est.jog[(est.dealer+k)%N]; if(!j.fora) ordem.push(j); }
  if(ordem.length < 2) return null;

  // --- declaração ---
  const amostras = [];
  let jaForam = 0;
  ordem.forEach((j, idx)=>{
    const obrigado = idx === ordem.length-1 && jaForam === 0;
    const f = falta(j.mao);
    const ctx = { falta:f, jaForam, nMesa:ordem.length, pts:j.pts, obrigado, pos:idx };
    let ir;
    if(obrigado) ir = true;
    else if(cfg.explora && rnd() < cfg.explora) ir = rnd() < 0.5;   // exploração: preenche a tabela
    else ir = decidirIr(ctx, pols[j.i], tab, rnd);
    if(ir && !obrigado) amostras.push({ j, k: chaveDecl(f, jaForam, ordem.length) });
    if(cfg.aoDeclarar) cfg.aoDeclarar(j, ctx, ir);
    j.foi = ir;
    if(ir) jaForam++;
  });

  // --- jogo ---
  const indo = ordem.filter(j=>j.foi);
  let venc = null;
  if(indo.length === 1){
    venc = indo[0];                                     // ganhou sozinho / ajudado
  }else{
    const perigo = new Set();
    let vi = 0, turnos = 0;
    while(turnos++ < (cfg.maxTurnos || 400)){
      const j = indo[vi], pol = pols[j.i];
      const topo = lixo[lixo.length-1];
      let pegou = false;
      if(topo && pegarDoLixo(j.mao, topo, pol)){
        j.mao.push(lixo.pop()); perigo.add(topo.r); perigo.add(topo.s); pegou = true;
      }
      if(!pegou){
        repor(deck, lixo, rnd);
        if(!deck.length) break;                         // acabou o baralho: rodada anulada
        j.mao.push(deck.pop());
      }
      const bi = indiceParaBater(j.mao);
      if(bi !== -1){ lixo.push(j.mao.splice(bi,1)[0]); venc = j; break; }
      lixo.push(j.mao.splice(escolherDescarte(j.mao, pol, perigo, rnd),1)[0]);
      vi = (vi+1) % indo.length;
    }
  }

  // --- pontos ---
  if(venc) ordem.forEach(j=>{
    if(j === venc) return;
    j.pts = Math.max(0, j.pts - (j.foi ? 2 : 1));
  });

  // --- recompra ---
  ordem.forEach(j=>{
    if(j.fora || j.pts > 0) return;
    const comPonto = est.jog.filter(x=>!x.fora && x.pts > 0);
    if(!comPonto.length){ j.fora = true; return; }
    j.rec = (j.rec||0) + 1;
    if(j.rec <= (cfg.recompras === undefined ? 1 : cfg.recompras))
      j.pts = Math.min(...comPonto.map(x=>x.pts));
    else j.fora = true;
  });

  if(cfg.coletar && venc) amostras.forEach(a => cfg.coletar(a.k, a.j === venc));
  if(cfg.aoFimRodada) cfg.aoFimRodada(venc, ordem);

  let d = est.dealer, volta = 0;
  do{ d = (d+1)%N; }while(est.jog[d].fora && ++volta < N);
  est.dealer = d;
  return venc;
}

function simularPartida(cfg){
  const N = cfg.n || 6, rnd = cfg.rnd || Math.random;
  const est = {
    jog: Array.from({length:N}, (_,i)=>({ i, pts:10, fora:false, rec:0 })),
    dealer: (rnd()*N)|0
  };
  const c = Object.assign({}, cfg, { rnd, pols: cfg.pols || Array(N).fill(POL_PADRAO) });
  let r = 0;
  while(r < (cfg.maxRodadas || 400)){
    if(est.jog.filter(j=>!j.fora).length <= 1) break;
    simularRodada(est, c); r++;
  }
  const vivos = est.jog.filter(j=>!j.fora);
  return { campeao: vivos.length ? vivos[0].i : -1, rodadas: r, pts: est.jog.map(j=>j.pts) };
}

/* ---------------------------------------------------------- aprendizado */
/* Iteração de política: joga com a tabela atual (mais um pouco de exploração),
   conta quantas vezes cada situação virou vitória, e a contagem VIRA a política.
   Sem rede neural: a tabela é legível e dá pra auditar por que o bot correu. */
function treinar(opts){
  const cfg = Object.assign({
    partidas: 400, n: 8, iteracoes: 3, explora: 0.18, recompras: 1, sementeInicial: 12345
  }, opts||{});
  let tab = cfg.tab || {};
  const hist = [];
  for(let it=0; it<cfg.iteracoes; it++){
    const novo = {};
    const coletar = (k, ganhou)=>{
      const e = novo[k] || (novo[k] = { ida:0, vit:0 });
      e.ida++; if(ganhou) e.vit++;
    };
    for(let g=0; g<cfg.partidas; g++){
      simularPartida({
        n: cfg.n, rnd: semente(cfg.sementeInicial + it*100003 + g),
        tab, coletar, explora: cfg.explora, recompras: cfg.recompras
      });
      if(cfg.progresso && (g % 25 === 0)) cfg.progresso(it, g, cfg.partidas);
    }
    tab = novo;
    hist.push({ iteracao: it+1, chaves: Object.keys(tab).length,
                amostras: Object.values(tab).reduce((a,e)=>a+e.ida,0) });
  }
  return { tabela: tab, hist };
}

/* mede duas políticas na mesma mesa: A na cadeira 0, B nas demais.
   A métrica que importa é PONTO PERDIDO POR RODADA, não vitória de partida. */
function avaliar(polA, polB, opts){
  const cfg = Object.assign({ partidas: 300, n: 8, tab: null, recompras: 1, sementeInicial: 777 }, opts||{});
  let vitA = 0, perdaA = 0, perdaB = 0, rodA = 0, rodB = 0;
  for(let g=0; g<cfg.partidas; g++){
    const N = cfg.n;
    const pols = Array.from({length:N}, (_,i)=> i===0 ? polA : polB);
    const rnd = semente(cfg.sementeInicial + g);
    const est = { jog: Array.from({length:N},(_,i)=>({i,pts:10,fora:false,rec:0})), dealer:(rnd()*N)|0 };
    const c = { n:N, rnd, pols, tab:cfg.tab, recompras:cfg.recompras,
      aoFimRodada: (venc, ordem)=>{
        ordem.forEach(j=>{
          const d = j===venc ? 0 : (j.foi ? 2 : 1);
          if(j.i===0){ perdaA += d; rodA++; } else { perdaB += d; rodB++; }
        });
      }};
    let r=0;
    while(r++ < 400){ if(est.jog.filter(j=>!j.fora).length<=1) break; simularRodada(est,c); }
    const vivos = est.jog.filter(j=>!j.fora);
    if(vivos.length && vivos[0].i === 0) vitA++;
  }
  return {
    partidas: cfg.partidas,
    vitoriasA: vitA, taxaVitoriaA: vitA/cfg.partidas,
    perdaPorRodadaA: rodA ? perdaA/rodA : 0,
    perdaPorRodadaB: rodB ? perdaB/rodB : 0
  };
}

/* subida de encosta nos pesos de descarte/compra (a declaração vem da tabela) */
function otimizar(opts){
  const cfg = Object.assign({ passos: 12, partidas: 120, n: 8, tab: null, base: POL_PADRAO }, opts||{});
  const CHAVES = ["pesoCob","pesoCoringa","pesoPar","ganhoLixo","perigo"];
  let campeao = Object.assign({}, cfg.base);
  let melhor = avaliar(campeao, campeao, {partidas:cfg.partidas, n:cfg.n, tab:cfg.tab});
  let refBase = melhor.perdaPorRodadaA;
  const trilha = [{ passo:0, pol:Object.assign({},campeao), perda:refBase }];
  const rnd = semente(4242);
  for(let p=1; p<=cfg.passos; p++){
    const cand = Object.assign({}, campeao);
    const k = CHAVES[(rnd()*CHAVES.length)|0];
    cand[k] = Math.max(0, +(cand[k] + (rnd()*2-1)*Math.max(1, cand[k]*0.5)).toFixed(2));
    const r = avaliar(cand, campeao, {partidas:cfg.partidas, n:cfg.n, tab:cfg.tab});
    const ganhou = r.perdaPorRodadaA < r.perdaPorRodadaB;
    if(ganhou){ campeao = cand; refBase = r.perdaPorRodadaA; }
    trilha.push({ passo:p, mexeu:k, valor:cand[k], perdaCand:r.perdaPorRodadaA,
                  perdaCampeao:r.perdaPorRodadaB, aceito:ganhou });
    if(cfg.progresso) cfg.progresso(p, cfg.passos);
  }
  return { pol: campeao, trilha };
}

/* ------------------------------------------------------- perfil do jogador */
/* Lê o log do jogo e descreve COMO a pessoa joga. Sem julgar: só conta. */
function perfil(log, tab){
  const decl = log.filter(e=>e.tipo==="declara");
  const desc = log.filter(e=>e.tipo==="descarta");
  const comp = log.filter(e=>e.tipo==="compra");
  const rod  = log.filter(e=>e.tipo==="rodada");
  const porFalta = {}, porVou = {}, porPts = {};
  const conta = (obj, chave, foi)=>{
    const e = obj[chave] || (obj[chave] = { n:0, ir:0 });
    e.n++; if(foi) e.ir++;
  };
  decl.forEach(e=>{
    if(e.obrigado) return;                            // não foi escolha dele
    conta(porFalta, Math.min(6, e.falta), e.foi);
    conta(porVou,   Math.min(3, e.jaForam||0), e.foi);
    conta(porPts,   e.pts<=2 ? "1-2" : e.pts<=5 ? "3-5" : e.pts<=8 ? "6-8" : "9+", e.foi);
  });
  // limiar: maior "falta" em que ele ainda vai mais da metade das vezes
  let limiar = null;
  Object.keys(porFalta).map(Number).sort((a,b)=>a-b).forEach(f=>{
    const e = porFalta[f];
    if(e.n >= 5 && e.ir/e.n >= 0.5) limiar = f;
  });
  const foiE = decl.filter(e=>e.foi && !e.obrigado);
  const ganhou = foiE.filter(e=>e.ganhou).length;
  // onde ele discorda da tabela aprendida, e quanto isso custa por decisão
  let divergiu = 0, custo = 0, avaliadas = 0;
  if(tab) decl.forEach(e=>{
    if(e.obrigado || e.falta === undefined) return;
    const ctx = { falta:e.falta, jaForam:e.jaForam||0, nMesa:e.nMesa||8, pts:e.pts, obrigado:false };
    const rec = evIr(probIr(ctx, tab), e.pts) > 0;
    avaliadas++;
    if(rec !== e.foi){
      divergiu++;
      custo += Math.abs(evIr(probIr(ctx, tab), e.pts));
    }
  });
  return {
    decisoes: decl.length,
    taxaIr: decl.length ? decl.filter(e=>e.foi).length/decl.length : 0,
    limiarFalta: limiar,
    porFalta, porVou, porPts,
    idas: foiE.length, vitoriasQuandoFoi: ganhou,
    aproveitamento: foiE.length ? ganhou/foiE.length : 0,
    coringaDescartado: desc.filter(e=>e.carta === "★").length,
    descartes: desc.length,
    pegouDoLixo: comp.filter(e=>e.de === "lixo").length, compras: comp.length,
    rodadas: rod.length,
    divergencia: avaliadas ? divergiu/avaliadas : null,
    custoMedioDivergencia: divergiu ? custo/divergiu : 0,
    avaliadas
  };
}

/* ------------------------------------------------------------------ api */
return {
  ORDEM, NAIPES, JOKER, ci, ehCoringa, rot,
  novoBaralho, embaralhar, semente, ordenar,
  ehJogo, fecha, maxCob, falta, indiceParaBater, melhorParticao, organizarMao,
  gruposVisiveis, tipoDoJogo,
  POL_PADRAO, pontuar, evIr, chaveDecl, probEstimada, probIr, decidirIr,
  pegarDoLixo, escolherDescarte, MIN_AMOSTRA,
  simularRodada, simularPartida, treinar, avaliar, otimizar, perfil
};
})();

if(typeof module !== "undefined") module.exports = CAC;
