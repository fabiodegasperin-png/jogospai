// Servidor local: serve o painel e repassa os dados do TSE (evita o bloqueio de CORS).
// Uso: node servidor_tse.js [porta]   ->  http://localhost:8080/apuracao.html
//
// /tse/<caminho>  busca https://resultados.tse.jus.br/oficial/<caminho> (cache de 15 s)
// /eleicoes       lista as eleicoes do arquivo de configuracao do TSE (para achar o codigo)
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORTA = Number(process.argv[2]) || 8080;
const BASE = "https://resultados.tse.jus.br/oficial/";
const CACHE_MS = 15000;
const cache = new Map();

function buscar(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < CACHE_MS) return Promise.resolve(hit);
  return new Promise((ok, falha) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }, r => {
      const partes = [];
      r.on("data", d => partes.push(d));
      r.on("end", () => {
        const res = { t: Date.now(), status: r.statusCode, corpo: Buffer.concat(partes) };
        if (r.statusCode === 200) cache.set(url, res);
        ok(res);
      });
    }).on("error", falha);
  });
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  try {
    if (u.pathname.startsWith("/tse/") || u.pathname === "/eleicoes") {
      const alvo = u.pathname === "/eleicoes" ? BASE + "comum/config/ele-c.json" : BASE + u.pathname.slice(5);
      const r = await buscar(alvo);
      res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(r.corpo);
    }
    const arq = path.join(__dirname, path.basename(u.pathname === "/" ? "apuracao.html" : u.pathname));
    if (!fs.existsSync(arq)) { res.writeHead(404); return res.end("nao encontrado"); }
    res.writeHead(200, { "Content-Type": arq.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    fs.createReadStream(arq).pipe(res);
  } catch (e) {
    res.writeHead(502); res.end("falha ao falar com o TSE: " + e.message);
  }
}).listen(PORTA, () => console.log(`Painel em http://localhost:${PORTA}/apuracao.html`));
