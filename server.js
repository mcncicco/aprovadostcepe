const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PORT = 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.csv');
const LOG_FILE = path.join(ROOT, 'access_log.csv');
const DEFAULT_GROUP_LINK = process.env.WHATSAPP_LINK || config.whatsappGroupLink;

function normalizarTexto(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizarData(value = '') {
  const texto = String(value).trim();
  if (!texto) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return texto;
}

function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter((linha) => linha.trim() !== '');
  const resultado = [];
  const delimitador = texto.includes(';') ? ';' : ',';

  for (const linha of linhas) {
    const campos = linha.split(delimitador).map((valor) => valor.trim());
    resultado.push(campos);
  }

  return resultado;
}

function lerCSV(caminho) {
  if (!fs.existsSync(caminho)) {
    return [];
  }

  const conteudo = fs.readFileSync(caminho, 'utf8');
  return parseCSV(conteudo);
}

function garantirLog() {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'data_hora,nome,nascimento,telefone,status,link\n', 'utf8');
  }
}

function registrarLog({ nome, nascimento, telefone, status, link }) {
  garantirLog();

  const dataHora = new Date().toISOString();
  const linha = [dataHora, nome, nascimento, telefone, status, link || ''].join(',');
  fs.appendFileSync(LOG_FILE, `${linha}\n`, 'utf8');
}

function leituraArquivo(caminho) {
  return fs.readFileSync(caminho, 'utf8');
}

function tipoConteudo(caminho) {
  const extensao = path.extname(caminho).toLowerCase();
  const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  return tipos[extensao] || 'text/plain; charset=utf-8';
}

function enviarResposta(res, statusCode, conteudo, contentType) {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(conteudo);
}

function tratarRotas(req, res) {
  if (req.method === 'GET' && req.url === '/') {
    const html = leituraArquivo(path.join(ROOT, 'index.html'));
    enviarResposta(res, 200, html, 'text/html; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && req.url === '/style.css') {
    const css = leituraArquivo(path.join(ROOT, 'style.css'));
    enviarResposta(res, 200, css, 'text/css; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && req.url === '/app.js') {
    const js = leituraArquivo(path.join(ROOT, 'app.js'));
    enviarResposta(res, 200, js, 'application/javascript; charset=utf-8');
    return;
  }

  if (req.method === 'POST' && req.url === '/validar') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const dados = JSON.parse(body || '{}');
        const nome = String(dados.nome || '').trim();
        const nascimento = normalizarData(dados.nascimento || '');

        if (!nome || !nascimento) {
          enviarResposta(res, 400, JSON.stringify({ ok: false, message: 'Nome e data de nascimento são obrigatórios.' }), 'application/json; charset=utf-8');
          return;
        }

        const linhas = lerCSV(DATA_FILE);
        if (linhas.length === 0) {
          registrarLog({ nome, nascimento, telefone: '', status: 'erro', link: '' });
          enviarResposta(res, 404, JSON.stringify({ ok: false, message: 'Nenhuma pessoa encontrada com esses dados.' }), 'application/json; charset=utf-8');
          return;
        }

        const indexNome = 1;
        const indexData = 2;
        const indexLink = linhas[0].findIndex((campo) => /https?:\/\//i.test(String(campo || '')));

        const pessoa = linhas.find((linha) => {
          const nomeLinha = (linha[indexNome] || '').trim();
          const dataLinha = normalizarData(linha[indexData] || '');
          return normalizarTexto(nomeLinha) === normalizarTexto(nome) && dataLinha === nascimento;
        });

        if (!pessoa) {
          registrarLog({ nome, nascimento, telefone: '', status: 'nao_encontrado', link: '' });
          enviarResposta(res, 404, JSON.stringify({ ok: false, message: 'Nenhuma pessoa encontrada com esses dados.' }), 'application/json; charset=utf-8');
          return;
        }

        const link = DEFAULT_GROUP_LINK;

        registrarLog({ nome, nascimento, telefone: '', status: 'ok', link });
        enviarResposta(res, 200, JSON.stringify({ ok: true, link }), 'application/json; charset=utf-8');
      } catch (error) {
        registrarLog({ nome: '', nascimento: '', telefone: '', status: 'erro_json', link: '' });
        enviarResposta(res, 500, JSON.stringify({ ok: false, message: 'Erro ao processar a validação.' }), 'application/json; charset=utf-8');
      }
    });
    return;
  }

  const caminhoSolicitado = req.url === '/' ? '/index.html' : req.url;
  const caminhoArquivo = path.join(ROOT, caminhoSolicitado.replace(/^\//, ''));

  if (fs.existsSync(caminhoArquivo) && fs.statSync(caminhoArquivo).isFile()) {
    const conteudo = leituraArquivo(caminhoArquivo);
    enviarResposta(res, 200, conteudo, tipoConteudo(caminhoArquivo));
    return;
  }

  enviarResposta(res, 404, 'Página não encontrada', 'text/plain; charset=utf-8');
}

const server = http.createServer((req, res) => {
  tratarRotas(req, res);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
