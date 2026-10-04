// Base: 1o turno da ultima eleicao (planilha PLANILHA_SEGUNDO_TURNO.xlsx). a = candidato 1, b = candidato 2.
const BASE_UFS = [
 {
  "uf": "Distrito Federal",
  "regiao": "CENTRO - OESTE",
  "a": 910397,
  "b": 649534,
  "outros": 202644
 },
 {
  "uf": "Goiás",
  "regiao": "CENTRO - OESTE",
  "a": 1920203,
  "b": 1454723,
  "outros": 306543
 },
 {
  "uf": "Mato Grosso",
  "regiao": "CENTRO - OESTE",
  "a": 1102866,
  "b": 633748,
  "outros": 106274
 },
 {
  "uf": "Mato Grosso do Sul",
  "regiao": "CENTRO - OESTE",
  "a": 794206,
  "b": 588323,
  "outros": 124460
 },
 {
  "uf": "Alagoas",
  "regiao": "NORDESTE",
  "a": 621515,
  "b": 974156,
  "outros": 128546
 },
 {
  "uf": "Bahia",
  "regiao": "NORDESTE",
  "a": 2047599,
  "b": 5873081,
  "outros": 502328
 },
 {
  "uf": "Ceará",
  "regiao": "NORDESTE",
  "a": 1377827,
  "b": 3578355,
  "outros": 473082
 },
 {
  "uf": "Maranhão",
  "regiao": "NORDESTE",
  "a": 983861,
  "b": 2603454,
  "outros": 194330
 },
 {
  "uf": "Paraíba",
  "regiao": "NORDESTE",
  "a": 717416,
  "b": 1554868,
  "outros": 149404
 },
 {
  "uf": "Pernambuco",
  "regiao": "NORDESTE",
  "a": 1630938,
  "b": 3558322,
  "outros": 262749
 },
 {
  "uf": "Piauí",
  "regiao": "NORDESTE",
  "a": 406897,
  "b": 1518008,
  "outros": 119481
 },
 {
  "uf": "Rio Grande do Norte",
  "regiao": "NORDESTE",
  "a": 622731,
  "b": 1264179,
  "outros": 120354
 },
 {
  "uf": "Sergipe",
  "regiao": "NORDESTE",
  "a": 378610,
  "b": 828716,
  "outros": 91106
 },
 {
  "uf": "Acre",
  "regiao": "NORTE",
  "a": 275582,
  "b": 129022,
  "outros": 36313
 },
 {
  "uf": "Amapá",
  "regiao": "NORTE",
  "a": 187621,
  "b": 197382,
  "outros": 47158
 },
 {
  "uf": "Amazonas",
  "regiao": "NORTE",
  "a": 880198,
  "b": 1019684,
  "outros": 156794
 },
 {
  "uf": "Pará",
  "regiao": "NORTE",
  "a": 1884673,
  "b": 2443730,
  "outros": 351533
 },
 {
  "uf": "Rondônia",
  "regiao": "NORTE",
  "a": 581306,
  "b": 261749,
  "outros": 60180
 },
 {
  "uf": "Roraima",
  "regiao": "NORTE",
  "a": 207587,
  "b": 68760,
  "outros": 22022
 },
 {
  "uf": "Tocantins",
  "regiao": "NORTE",
  "a": 379194,
  "b": 434303,
  "outros": 48295
 },
 {
  "uf": "Espírito Santo",
  "regiao": "SUDESTE",
  "a": 1160030,
  "b": 897348,
  "outros": 163752
 },
 {
  "uf": "Minas Gerais",
  "regiao": "SUDESTE",
  "a": 5239264,
  "b": 5802571,
  "outros": 974879
 },
 {
  "uf": "Rio de Janeiro",
  "regiao": "SUDESTE",
  "a": 4831246,
  "b": 3847143,
  "outros": 778288
 },
 {
  "uf": "São Paulo",
  "regiao": "SUDESTE",
  "a": 12239989,
  "b": 10490032,
  "outros": 2926313
 },
 {
  "uf": "Paraná",
  "regiao": "SUL",
  "a": 3628612,
  "b": 2363492,
  "outros": 574660
 },
 {
  "uf": "Rio Grande do Sul",
  "regiao": "SUL",
  "a": 3245023,
  "b": 2806672,
  "outros": 586057
 },
 {
  "uf": "Santa Catarina",
  "regiao": "SUL",
  "a": 2694406,
  "b": 1279216,
  "outros": 357362
 },
 {
  "uf": "Exterior",
  "regiao": "EXTERIOR",
  "a": 122548,
  "b": 138933,
  "outros": 33044
 }
];

// Modelo de projecao por balanco (swing).
// entrada: { uf: { apurado: 0..1, pctA: 0..1 } }  (pctA = parcela do candidato 1 entre os dois, na parte ja apurada)
// Estados sem entrada recebem a base + balanco nacional medio (ponderado pelo quanto ja foi apurado).
function projetar(entrada, participacao = 1) {
  const base = BASE_UFS.map(u => ({ ...u, tot: u.a + u.b, shareBase: u.a / (u.a + u.b) }));
  let pesoSoma = 0, balancoSoma = 0;
  for (const u of base) {
    const e = entrada[u.uf];
    if (e && e.apurado > 0) {
      const peso = e.apurado * u.tot;
      pesoSoma += peso; balancoSoma += peso * (e.pctA - u.shareBase);
    }
  }
  const balancoNac = pesoSoma ? balancoSoma / pesoSoma : 0;
  const clamp = x => Math.min(1, Math.max(0, x));
  const saida = base.map(u => {
    const e = entrada[u.uf];
    const w = e ? clamp(e.apurado) : 0;
    let share;
    if (w > 0) {
      // quanto mais apurado, mais se confia no balanco do proprio estado; o resto vem do balanco nacional
      const balEst = w * (e.pctA - u.shareBase) + (1 - w) * balancoNac;
      share = w * e.pctA + (1 - w) * clamp(u.shareBase + balEst);
    } else share = clamp(u.shareBase + balancoNac);
    const total = u.tot * participacao;
    return { uf: u.uf, regiao: u.regiao, apurado: w, shareBase: u.shareBase, share, votosA: share * total, votosB: (1 - share) * total };
  });
  const soma = lista => {
    const A = lista.reduce((s, x) => s + x.votosA, 0), B = lista.reduce((s, x) => s + x.votosB, 0);
    return { votosA: A, votosB: B, share: A / (A + B) };
  };
  const regioes = [...new Set(saida.map(s => s.regiao))].map(r => ({ regiao: r, ...soma(saida.filter(s => s.regiao === r)) }));
  return { ufs: saida, regioes, nacional: soma(saida), balancoNac };
}
if (typeof module !== "undefined") module.exports = { BASE_UFS, projetar };
