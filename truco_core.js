"use strict";
/* =========================================================
   truco_core.js — o motor do truco, sem tela.
   Roda no navegador (jogos.html) e no Node (treinar_truco.js).
   Fonte única: se a regra muda aqui, muda nos dois.

   O ponto do arquivo é PARAMS: tudo que antes era número chutado
   solto no meio do código virou um campo com nome. É isso que o
   treinamento mexe — o motor de cartas em si não muda.
   ========================================================= */
const TRUCO = (function(){

const ORDEM  = ["4","5","6","7","10","11","12","1","2","3"];   // fraca -> forte
const NAIPES = ["O","E","C","P"];                              // mole < espada < copa < gato
const FORCA_NAIPE = { O:1, E:2, C:3, P:4 };
const PROX = { 1:3, 3:6, 6:9, 9:12 };

/* ---- o "DNA" de um jogador ---- */
const PADRAO = {
  // limiares de aposta (chance de ganhar a mão, 0 a 1)
  pedir:       0.64,   // pra pedir truco na sua vez
  subir:       0.70,   // pra subir uma aposta que veio
  margem:     -0.03,   // soma ao preço matemático de aceitar (negativo = aceita mais)
  freqPede:    0.58,   // com mão boa, com que frequência de fato pede
  pagaPraVer:  0.22,   // aceita mesmo sem conta fechar
  certeza:     0.90,   // ganho certo (ultimo a jogar com a folha): pede SEMPRE, sem sortear
  leitura:     0.75,   // o quanto acredita que quem pediu truco tem carta (0 = surdo)
  pesoFalta:   0.60,   // o quanto o placar mexe na conta de aceitar/pedir
  memoria:     0.60,   // o quanto o historico DESTA partida corrige a leitura

  // blefe
  blefe:       0.17,   // base
  bl3:         0.40,   // escala ao blefar um seis
  bl6:         0.18,   // ... um nove
  bl9:         0.08,   // ... um doze
  blefeMin:    0.22,   // abaixo dessa chance nem blefa (posição perdida)
  blefeMax:    0.40,   // acima disso não é blefe, é mão boa

  // momento da mão: quando truqueiro pede e quando cala a boca
  mSaida:            0.25,   // de saída, sem ver nada
  mPrimeira:         0.55,   // primeira rodada, já viu carta
  mGanhouPrimeira:   1.35,   // ganhou a primeira: a hora clássica
  mSemCartas:        0.60,   // já jogou tudo
  mSemCartasExposto: 0.35,   // jogou tudo e o adversário ainda decide olhando a carta dele

  // dupla: apostar gasta os pontos do parceiro
  cegoPedir:  0.09,   // quanto sobe o limiar sem ver a mão do parceiro
  cegoBlefe:  0.30,   // quanto encolhe o blefe
  cegoFreq:   0.55,   // quanto encolhe a vontade de pedir

  escondeCarta: 0.65,  // com que frequencia esconde quando a carta perde de qualquer jeito

  // motor
  sims: 260,          // simulações por decisão
  erro: 0             // chance de pegar a 2a melhor carta (handicap dos níveis fáceis)
};

/* ---- helpers ---- */
const chave      = c => c.r + c.s;
/* Carta virada (jogada de costas) perde de qualquer carta aberta.
   Serve pra descartar sem mostrar o que voce tinha. */
const forca      = (c, man) => !c ? -1 : c.virada ? 0 :
                   (c.r === man ? 10 + FORCA_NAIPE[c.s] : ORDEM.indexOf(c.r) + 1);
const manilhaDe  = vira => ORDEM[(ORDEM.indexOf(vira.r) + 1) % ORDEM.length];
const sigla      = t => t === 0 ? "p" : "b";
const proxValor  = v => PROX[v] || null;
const limiteAceite = (vNovo, vVelho) => (vNovo - vVelho) / (2 * vNovo);

function baralho(){ const b = []; ORDEM.forEach(r => NAIPES.forEach(s => b.push({r,s}))); return b; }
function embaralha(a, rnd){
  for(let i=a.length-1;i>0;i--){ const j = (rnd()*(i+1))|0; [a[i],a[j]] = [a[j],a[i]]; }
  return a;
}
/* rng determinístico, pra poder repetir um experimento */
function semente(n){
  let s = n >>> 0;
  return function(){ s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* null = indefinido; "p"/"b" = time vencedor; "n" = mão anulada */
function donoDaMao(r){
  const conta = w => r.filter(x => x === w).length;
  if(conta("p") >= 2) return "p";
  if(conta("b") >= 2) return "b";
  if(r.length === 0) return null;
  if(r[0] === "t"){
    const primeiro = r.find(x => x !== "t");
    if(primeiro) return primeiro;
    return r.length === 3 ? "n" : null;
  }
  if(r.length >= 2 && r[1] === "t") return r[0];
  if(r.length === 3) return r[0];
  return null;
}

/* =========================================================
   Simulação: joga a mão até o fim com uma política rápida.
   ========================================================= */
function politica(S, a){
  const mao = S.maos[a];
  const ord = mao.map((c,i)=>({ f: forca(c, S.manilha), i })).sort((x,y)=> x.f - y.f);
  let lider = null;
  for(let i=0;i<S.n;i++){ const c = S.mesa[i]; if(!c) continue;
    const f = forca(c, S.manilha); if(!lider || f > lider.f) lider = { i, f }; }
  if(!lider) return ord[ord.length-1].i;                 // abre com a mais forte
  let empateContra = false;
  for(let i=0;i<S.n;i++){ const c = S.mesa[i];
    if(c && i !== lider.i && forca(c,S.manilha) === lider.f && S.times[i] !== S.times[lider.i]) empateContra = true; }
  if(S.times[lider.i] === S.times[a] && !empateContra) return ord[0].i;   // aliado ganhando: economiza
  for(const o of ord) if(o.f > lider.f) return o.i;      // mata com a mais barata
  return ord[0].i;                                       // não dá: descarta a pior
}

function simulaMao(S){
  let guard = 0;
  while(donoDaMao(S.vazas) === null && guard++ < 24){
    if(S.pos >= S.n){
      let mx = -1, topos = [];
      for(let i=0;i<S.n;i++){ const c = S.mesa[i]; if(!c) continue;
        const f = forca(c, S.manilha);
        if(f > mx){ mx = f; topos = [i]; } else if(f === mx) topos.push(i); }
      const times = new Set(topos.map(i => S.times[i]));
      const r = times.size > 1 ? "t" : sigla(S.times[topos[0]]);
      S.vazas.push(r);
      if(donoDaMao(S.vazas) !== null) break;
      if(r !== "t") S.abreVaza = topos[0];
      S.mesa = new Array(S.n).fill(null);
      S.ordem = []; for(let k=0;k<S.n;k++) S.ordem.push(((S.abreVaza - k) % S.n + S.n) % S.n);
      S.pos = 0;
      continue;
    }
    const a = S.ordem[S.pos];
    if(!S.maos[a].length) break;
    S.mesa[a] = S.maos[a].splice(politica(S,a), 1)[0];
    S.pos++;
  }
  return donoDaMao(S.vazas);
}

/* =========================================================
   O que cada assento enxerga. Ninguém vê carta de adversário.
   ========================================================= */
function parceiroDe(E, a){
  return E.n === 4 ? E.times.findIndex((tm,i)=> i !== a && tm === E.times[a]) : -1;
}
/* Só consulta a mão do parceiro quem está RESPONDENDO a uma aposta.
   Quem pede não olha — pediu por conta própria. */
function parceiroVisivel(E, a){
  if(!E.parceiroAberto) return -1;
  if(E.parceiroAberto !== true && E.parceiroAberto !== sigla(E.times[a])) return -1;
  return parceiroDe(E, a);
}

function desconhecidas(E, a){
  const par = parceiroVisivel(E, a);
  const minhas = par >= 0 ? E.maos[a].concat(E.maos[par]) : E.maos[a];
  const meusOcultos = (E.viradas && E.viradas[a]) || [];   // eu sei o que eu escondi
  const vistas = new Set([chave(E.vira), ...E.jogadas.map(chave), ...minhas.map(chave), ...meusOcultos.map(chave)]);
  const fora = [];
  ORDEM.forEach(r => NAIPES.forEach(s => { if(!vistas.has(r+s)) fora.push({r,s}); }));
  return fora;
}
/* ---- leitura da mesa ----
   Sortear as cartas dos outros de forma uniforme e ignorar tudo que eles
   fizeram. Quem pede truco quase sempre tem carta: as mãos sorteadas que
   não sustentam a aposta são descartadas e resorteadas. É o que faz o bot
   desconfiar de blefe e correr de mão de verdade.
   ponytail: só a aposta é lida. Ler também a carta que o cara escolheu
   jogar (jogou o 4 de saída = mão fraca) pede um modelo de jogada. */
const FORCA_APOSTA = { 3:8, 6:11, 9:11, 12:11 };   // 8 = um "1"; 11 = manilha
function exigencia(E){
  if(!E.ultimoPediu) return null;
  return { time: E.ultimoPediu === "p" ? 0 : 1,
           alvo: FORCA_APOSTA[E.pendente || E.valor] || 8 };
}
/* a mão sorteada explica a aposta que aquele time fez? */
function coerente(E, maos, exig, a, par){
  let incognita = false;
  for(let i=0;i<E.n;i++){
    if(E.times[i] !== exig.time || i === a || i === par || !maos[i].length) continue;
    incognita = true;
    if(maos[i].some(c => forca(c, E.manilha) >= exig.alvo)) return true;
  }
  return !incognita;                               // nada a inferir: serve
}
/* ---- memoria desta partida ----
   O perfil no localStorage leva partidas pra se formar. Dentro de UMA
   partida ele tambem tem que aprender: quem pediu e perdeu a mao na cara
   dele ja entregou alguma coisa. So conta mao que foi ate as cartas —
   quando o outro corre, ninguem viu nada e nao ha o que aprender. */
function forcaLeitura(E, P, time){
  const m = E.memoria && E.memoria[time];
  if(!m || m.pediu < 3) return P.leitura;
  return P.leitura * (1 - (P.memoria || 0) * (m.perdeu / m.pediu));
}
function reparte(E, a, fora, rnd, P){
  const par = parceiroVisivel(E, a);
  const exig0 = P && P.leitura ? exigencia(E) : null;
  const exig = (exig0 && rnd() < forcaLeitura(E, P, exig0.time)) ? exig0 : null;
  let maos;
  for(let tent=0; tent<8; tent++){
    embaralha(fora, rnd);
    let p = 0;
    maos = E.maos.map((m,i)=>{
      if(i === a || i === par) return m.slice();   // já sei essas
      const q = fora.slice(p, p + m.length); p += m.length; return q;
    });
    if(!exig || coerente(E, maos, exig, a, par)) break;
  }
  return maos;                                     // desistiu de filtrar: vale o último
}
function base(E, maos){
  return { n:E.n, times:E.times, manilha:E.manilha, mesa:E.mesa.slice(),
           vazas:E.vazas.slice(), abreVaza:E.abreVaza, ordem:E.ordem.slice(), pos:E.pos, maos };
}
const ponto = (dono, time) => dono === "n" ? 0.5 : (dono === sigla(time) ? 1 : 0);

/* chance de cada carta da mão de `a` ganhar a mão (mesmo sorteio pra todas) */
/* aceita P (objeto) ou só o número de simulações, pra não quebrar chamada antiga */
const comoP = x => typeof x === "number" ? { sims:x } : x;
function avaliaJogadas(E, a, P_, rnd){
  const P = comoP(P_), sims = P.sims;
  const mao = E.maos[a], fora = desconhecidas(E, a), res = mao.map(()=>0);
  for(let s=0;s<sims;s++){
    const b = reparte(E, a, fora, rnd, P);
    for(let k=0;k<mao.length;k++){
      const maos = b.map(m => m.slice());
      const S = base(E, maos);
      S.mesa[a] = S.maos[a].splice(k,1)[0];
      S.pos++;
      res[k] += ponto(simulaMao(S), E.times[a]);
    }
  }
  return res.map(x => x / sims);
}
/* chance do time de `a` ganhar a mão daqui pra frente */
function probMao(E, a, P_, rnd){
  const P = comoP(P_), sims = P.sims;
  const fora = desconhecidas(E, a);
  let tot = 0;
  for(let s=0;s<sims;s++) tot += ponto(simulaMao(base(E, reparte(E, a, fora, rnd, P))), E.times[a]);
  return tot / sims;
}

/* =========================================================
   Decisões (é aqui que os PARAMS mandam)
   ========================================================= */
function momento(E, a, P){
  const semCartas = !E.maos[a].length;
  const primeira  = E.vazas.length === 0;
  const mesaVazia = E.mesa.every(c => !c);
  let f = 1;
  if(primeira && mesaVazia) f = P.mSaida;
  else if(primeira)         f = P.mPrimeira;
  else if(E.vazas[0] === sigla(E.times[a])) f = P.mGanhouPrimeira;

  const faltaAdversario = E.mesa.some((c,i)=> !c && E.times[i] !== E.times[a] && E.maos[i].length);
  if(semCartas && faltaAdversario) f *= P.mSemCartasExposto;
  else if(semCartas) f *= P.mSemCartas;
  return f;
}
/* ---- o placar ----
   11 x 0 e 11 x 11 nao sao o mesmo jogo. Duas coisas mudam tudo:
   - se correr ja entrega a partida, correr nao e opcao: aceita e reza.
   - se eles ganham a partida ganhando esta mao, pedir e de graca:
     nao ha mais nada a perder alem do que ja esta na mesa. */
function falta(E, time){
  const alvo = E.alvo || 12;
  return E.placar ? Math.max(1, alvo - E.placar[time]) : alvo;
}
function ajusteFalta(E, time, P){
  if(!E.placar) return 0;
  const w = P.pesoFalta || 0, emJogo = E.pendente || E.valor;
  let d = 0;
  if(falta(E, 1-time) > E.valor && falta(E, 1-time) <= emJogo) d += 0.15 * w;  // aceitar arrisca a partida
  if(falta(E, time) <= emJogo) d -= 0.15 * w;                                   // ganhar esta fecha o jogo
  return d;
}
function escalaBlefe(P, valor){
  return valor === 1 ? 1 : valor === 3 ? P.bl3 : valor === 6 ? P.bl6 : P.bl9;
}
function assentoQueDecide(E, time){
  const meus = E.times.map((x,i)=> x === time ? i : -1).filter(i => i >= 0);
  const comCartas = meus.filter(i => E.maos[i].length);
  if(!comCartas.length) return meus[0];
  for(let k=0;k<E.n;k++){ const i = E.ordem[(E.pos + k) % E.n]; if(comCartas.includes(i)) return i; }
  return comCartas[0];
}

/* qual carta jogar -> índice na mão */
function liderDaVaza(E){
  let l = null;
  for(let i=0;i<E.n;i++){ const c = E.mesa[i]; if(!c) continue;
    const f = forca(c, E.manilha); if(!l || f > l.f) l = { i, f }; }
  return l;
}

/* devolve { i, virada } */
function decideCarta(E, a, P, rnd){
  const probs = avaliaJogadas(E, a, P, rnd);
  const mao = E.maos[a];
  let melhor = 0;
  for(let i=1;i<probs.length;i++){
    const d = probs[i] - probs[melhor];
    // empatou? guarda a carta forte pra depois
    if(d > 1e-9 || (Math.abs(d) < 1e-9 && forca(mao[i],E.manilha) < forca(mao[melhor],E.manilha))) melhor = i;
  }
  // handicap dos níveis fáceis: a 2a melhor, não uma carta qualquer
  if(probs.length > 1 && rnd() < P.erro){
    const ord = probs.map((p,i)=>({p,i})).sort((x,y)=> y.p - x.p);
    melhor = ord[1].i;
  }
  // esconder so faz sentido quando a carta perde de qualquer jeito (empatar e melhor que perder)
  const lider = liderDaVaza(E);
  const perdeAssim = lider && forca(E.maos[a][melhor], E.manilha) < lider.f;
  // na primeira rodada ninguém esconde (regra da casa)
  const virada = !!(perdeAssim && E.vazas.length >= 1 && rnd() < (P.escondeCarta || 0));
  return { i: melhor, virada };
}

/* vai pedir truco agora? */
function querPedir(E, a, P, rnd){
  const prox = proxValor(E.valor);
  if(!prox || E.ultimoPediu === sigla(E.times[a])) return false;
  const p = probMao(E, a, P, rnd), r = rnd(), m = momento(E, a, P);
  const meu = E.times[a];
  if(E.placar && P.pesoFalta){
    // eles fecham a partida ganhando esta mao: subir nao custa mais nada
    if(falta(E, 1-meu) <= E.valor) return p > P.blefeMin;
    // esta mao ja fecha a partida pro meu time: subir so aumenta o que eles levam
    if(falta(E, meu) <= E.valor && p <= (P.certeza || 1.01)) return false;
  }
  // ganho praticamente certo: pedir e de graca. Se o outro corre, levo o que
  // ja era meu; se aceita, levo mais. Aqui nao se sorteia nem se poupa.
  if(p > (P.certeza || 1.01)) return true;
  const cego = E.n === 4 && parceiroVisivel(E, a) < 0;
  const blefe = P.blefe * escalaBlefe(P, E.valor) * m * (cego ? P.cegoBlefe : 1);
  const forte = p > P.pedir + (cego ? P.cegoPedir : 0);
  return forte ? r < P.freqPede * m * (cego ? P.cegoFreq : 1)
               : (p > P.blefeMin && p < P.blefeMax && r < blefe);
}

/* responder uma aposta -> "subir" | "aceitar" | "correr" */
function responde(E, time, P, rnd){
  const a = assentoQueDecide(E, time);
  const p = probMao(E, a, P, rnd), r = rnd();
  const prox = proxValor(E.pendente);
  const cego = E.n === 4 && parceiroVisivel(E, a) < 0;
  const blefe = P.blefe * escalaBlefe(P, E.valor) * momento(E, a, P) * (cego ? P.cegoBlefe : 1);
  const lim = limiteAceite(E.pendente, E.valor) + P.margem + ajusteFalta(E, time, P);
  // correr entrega o valor atual; se isso ja fecha a partida deles, correr e
  // desistir. Aceitar da pelo menos a chance p.
  const correrPerdeTudo = E.placar && P.pesoFalta && falta(E, 1-time) <= E.valor;
  if(correrPerdeTudo && !(prox && p > P.subir)) return "aceitar";
  if(prox && (p > (P.certeza || 1.01) || p > P.subir + (cego ? P.cegoPedir : 0) || (p > P.blefeMin && r < blefe))) return "subir";
  // espelho da `certeza`: derrota certa nao se paga pra ver. O "pagaPraVer"
  // e pra mao duvidosa, nao pra folha que ja perdeu na mesa.
  if(p < 1 - (P.certeza || 1.01)) return "correr";
  if(p > lim || r < P.pagaPraVer) return "aceitar";
  return "correr";
}

/* =========================================================
   Partida sem tela: dois DNAs se enfrentam até 12 pontos.
   ========================================================= */
function novaMao(E, rnd){
  const b = embaralha(baralho(), rnd);
  E.maos = []; for(let i=0;i<E.n;i++) E.maos.push(b.slice(i*3, i*3+3));
  E.vira = b[E.n*3];
  E.manilha = manilhaDe(E.vira);
  E.vazas = []; E.jogadas = []; E.viradas = []; for(let i=0;i<E.n;i++) E.viradas.push([]);
  E.valor = 1; E.pendente = null; E.ultimoPediu = null; E.parceiroAberto = false;
  E.pediuNaMao = { p:false, b:false };
  E.abreVaza = E.abreMao;
  iniciaVaza(E);
}
function iniciaVaza(E){
  E.mesa = new Array(E.n).fill(null);
  E.ordem = []; for(let k=0;k<E.n;k++) E.ordem.push(((E.abreVaza - k) % E.n + E.n) % E.n);
  E.pos = 0;
}
function resolveVaza(E){
  let mx = -1, topos = [];
  for(let i=0;i<E.n;i++){ const c = E.mesa[i]; if(!c) continue;
    const f = forca(c, E.manilha);
    if(f > mx){ mx = f; topos = [i]; } else if(f === mx) topos.push(i); }
  const times = new Set(topos.map(i => E.times[i]));
  const r = times.size > 1 ? "t" : sigla(E.times[topos[0]]);
  E.vazas.push(r);
  if(r !== "t") E.abreVaza = topos[0];
  return r;
}

/* negociação: quem pediu, o outro responde, pode subir de volta.
   devolve null (segue o jogo) ou {vencedor, pontos} se alguém correu. */
function negocia(E, pedinte, PS, rnd){
  let quem = sigla(E.times[pedinte]);
  E.pendente = proxValor(E.valor);
  E.ultimoPediu = quem;
  if(E.pediuNaMao) E.pediuNaMao[quem] = true;
  if(E.n === 4) E.parceiroAberto = quem === "p" ? "b" : "p";   // quem responde é que consulta
  let guard = 0;
  while(guard++ < 6){
    const timeResp = quem === "p" ? 1 : 0;
    const acao = responde(E, timeResp, PS[timeResp], rnd);
    if(acao === "correr"){
      const venc = quem;                      // quem pediu leva o valor anterior
      E.parceiroAberto = false;
      return { vencedor: venc, pontos: E.valor, correu: true };
    }
    if(acao === "aceitar"){
      E.valor = E.pendente; E.pendente = null; E.parceiroAberto = false;
      return null;
    }
    // subir
    const nova = proxValor(E.pendente);
    if(!nova){ E.valor = E.pendente; E.pendente = null; E.parceiroAberto = false; return null; }
    E.valor = E.pendente; E.pendente = nova;
    quem = sigla(timeResp); E.ultimoPediu = quem;
  }
  E.valor = E.pendente || E.valor; E.pendente = null; E.parceiroAberto = false;
  return null;
}

/* quem pediu nesta mao, e o que deu */
function anotaMemoria(E, vencedor, correu){
  if(!E.memoria || correu) return;                  // correu: ninguem mostrou carta
  ["p","b"].forEach((sg, t)=>{
    if(!E.pediuNaMao || !E.pediuNaMao[sg]) return;
    E.memoria[t].pediu++;
    if(vencedor !== sg && vencedor !== "n") E.memoria[t].perdeu++;
  });
}
function jogaMao(E, PS, rnd){
  novaMao(E, rnd);
  let guard = 0;
  while(guard++ < 40){
    const dono = donoDaMao(E.vazas);
    if(dono !== null) return { vencedor: dono, pontos: E.valor };
    if(E.pos >= E.n){ resolveVaza(E); iniciaVaza(E); continue; }
    const a = E.ordem[E.pos];
    const P = PS[E.times[a]];
    if(E.valor < 12 && querPedir(E, a, P, rnd)){
      const fim = negocia(E, a, PS, rnd);
      if(fim) return fim;
    }
    const d = decideCarta(E, a, P, rnd);
    const carta = E.maos[a].splice(d.i,1)[0];
    if(d.virada){ carta.virada = true; E.viradas[a].push({ r:carta.r, s:carta.s }); }
    else E.jogadas.push(carta);
    E.mesa[a] = carta;
    E.pos++;
  }
  return { vencedor: donoDaMao(E.vazas) || "n", pontos: E.valor };
}

/* uma partida até 12; devolve quem venceu e como os pontos foram feitos */
function partida(P0, P1, opts){
  const o = Object.assign({ n:2, alvo:12, abre:0 }, opts||{});
  const rnd = o.rnd || Math.random;
  const placar = [0,0];
  const E = { n:o.n, times: o.n === 2 ? [0,1] : [0,1,0,1], abreMao:o.abre,
              placar, alvo:o.alvo,
              memoria: [ {pediu:0, perdeu:0}, {pediu:0, perdeu:0} ] };   // mesma referência: o placar anda sozinho
  const stats = { maos:0, apostadas:0, ptsApostados:[0,0], ptsSimples:[0,0], correu:[0,0] };
  let guard = 0;
  while(placar[0] < o.alvo && placar[1] < o.alvo && guard++ < 200){
    const r = jogaMao(E, [P0,P1], rnd);
    anotaMemoria(E, r.vencedor, r.correu);
    stats.maos++;
    if(r.vencedor !== "n"){
      const t = r.vencedor === "p" ? 0 : 1;
      placar[t] += r.pontos;
      if(r.pontos > 1){ stats.apostadas++; stats.ptsApostados[t] += r.pontos; }
      else stats.ptsSimples[t] += r.pontos;
    }
    E.abreMao = ((E.abreMao - 1) % E.n + E.n) % E.n;
  }
  return { vencedor: placar[0] >= o.alvo ? 0 : 1, placar, stats };
}

/* N partidas alternando quem abre; devolve taxa de vitória do DNA A */
function duelo(PA, PB, opts){
  const o = Object.assign({ partidas:200, n:2, semente:1 }, opts||{});
  const rnd = semente(o.semente);
  let vitA = 0; const agg = { ptsApostados:[0,0], ptsSimples:[0,0], maos:0 };
  for(let i=0;i<o.partidas;i++){
    // metade das partidas com os papéis trocados: tira a vantagem de abrir
    const troca = i % 2 === 1;
    const r = partida(troca ? PB : PA, troca ? PA : PB, { n:o.n, abre: i % o.n, rnd });
    const venceuA = troca ? r.vencedor === 1 : r.vencedor === 0;
    if(venceuA) vitA++;
    const iA = troca ? 1 : 0, iB = troca ? 0 : 1;
    agg.ptsApostados[0] += r.stats.ptsApostados[iA]; agg.ptsApostados[1] += r.stats.ptsApostados[iB];
    agg.ptsSimples[0]   += r.stats.ptsSimples[iA];   agg.ptsSimples[1]   += r.stats.ptsSimples[iB];
    agg.maos += r.stats.maos;
  }
  return { taxaA: vitA / o.partidas, partidas:o.partidas, agg };
}

/* =========================================================
   Torneio evolutivo: os DNAs vencedores geram filhos mutados.
   ========================================================= */
const MEXIVEIS = ["pedir","subir","margem","freqPede","pagaPraVer","blefe","certeza","leitura","pesoFalta","memoria",
                  "bl3","bl6","bl9","blefeMin","blefeMax",
                  "mSaida","mPrimeira","mGanhouPrimeira","mSemCartas","mSemCartasExposto",
                  "cegoPedir","cegoBlefe","cegoFreq"];
const LIMITES = {
  pedir:[0.35,0.95], subir:[0.40,0.98], margem:[-0.25,0.25], freqPede:[0.1,1],
  pagaPraVer:[0,0.6], blefe:[0,0.6], certeza:[0.75,1], leitura:[0,1], pesoFalta:[0,1.5], memoria:[0,1], bl3:[0,1], bl6:[0,1], bl9:[0,1],
  blefeMin:[0,0.45], blefeMax:[0.2,0.8],
  mSaida:[0,1.5], mPrimeira:[0,1.5], mGanhouPrimeira:[0.3,2.5],
  mSemCartas:[0,1.5], mSemCartasExposto:[0,1.5],
  cegoPedir:[0,0.3], cegoBlefe:[0,1], cegoFreq:[0,1]
};
function muta(P, forca_, rnd){
  const f = Object.assign({}, P);
  const quantos = 1 + ((rnd()*3)|0);
  for(let k=0;k<quantos;k++){
    const campo = MEXIVEIS[(rnd()*MEXIVEIS.length)|0];
    const [lo,hi] = LIMITES[campo];
    const passo = (hi - lo) * forca_ * (rnd()*2 - 1);
    f[campo] = Math.max(lo, Math.min(hi, f[campo] + passo));
  }
  if(f.blefeMax <= f.blefeMin) f.blefeMax = f.blefeMin + 0.05;
  return f;
}

return { ORDEM, NAIPES, FORCA_NAIPE, PADRAO, MEXIVEIS, LIMITES,
         chave, forca, manilhaDe, sigla, proxValor, limiteAceite, baralho, embaralha, semente,
         donoDaMao, politica, simulaMao,
         parceiroDe, parceiroVisivel, desconhecidas, reparte, exigencia, coerente, avaliaJogadas, probMao,
         momento, escalaBlefe, falta, ajusteFalta, forcaLeitura, anotaMemoria, assentoQueDecide, decideCarta, querPedir, responde,
         jogaMao, partida, duelo, muta };
})();

if(typeof module !== "undefined") module.exports = TRUCO;
