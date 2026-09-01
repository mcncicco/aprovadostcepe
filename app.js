const form = document.getElementById('formulario');
const nomeInput = document.getElementById('nome');
const nascimentoInput = document.getElementById('nascimento');
const resultado = document.getElementById('resultado');

let registros = [];

function normalizeText(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeDate(value = '') {
  const texto = value.toString().trim();

  if (!texto) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split('-');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return texto;
}

function parseCSV(text) {
  const linhas = text.split(/\r?\n/).filter((linha) => linha.trim() !== '');
  const registrosCSV = [];
  const delimitador = text.includes(';') ? ';' : ',';

  for (const linha of linhas) {
    const linhaProcessada = linha.split(delimitador).map((valor) => valor.trim());
    registrosCSV.push(linhaProcessada);
  }

  return registrosCSV;
}

function carregarDados() {
  fetch('data.csv')
    .then((resposta) => {
      if (!resposta.ok) {
        throw new Error('Não foi possível carregar a lista de participantes.');
      }
      return resposta.text();
    })
    .then((csvText) => {
      const linhas = parseCSV(csvText);

      if (linhas.length < 2) {
        throw new Error('O arquivo CSV está vazio ou sem os campos esperados.');
      }

      const indiceNome = 1;
      const indiceData = 2;
      const indiceLink = linhas[0].findIndex((campo) => /https?:\/\//i.test(String(campo || '')));

      registros = linhas.map((linha) => ({
        nome: linha[indiceNome] || '',
        nascimento: linha[indiceData] || '',
        link: indiceLink >= 0 ? (linha[indiceLink] || '') : ''
      }));
    })
    .catch((erro) => {
      mostrarMensagem(
        `Não foi possível carregar a base de dados. ${erro.message}`,
        'error'
      );
    });
}

function mostrarMensagem(mensagem, tipo = 'success') {
  resultado.classList.add('visible', tipo);
  resultado.innerHTML = mensagem;
}

async function verificarCadastro(evento) {
  evento.preventDefault();

  const nome = nomeInput.value.trim();
  const nascimento = normalizeDate(nascimentoInput.value);

  if (!nome || !nascimento) {
    mostrarMensagem('Preencha nome e data de nascimento.', 'error');
    return;
  }

  nascimentoInput.value = nascimento;

  try {
    const resposta = await fetch('/validar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nome,
        nascimento
      })
    });

    const dados = await resposta.json();

    if (!dados.ok) {
      mostrarMensagem(dados.message || 'Nenhuma pessoa encontrada com esses dados.', 'error');
      return;
    }

    mostrarMensagem(
      `Dados confirmados! Clique no link abaixo para entrar no grupo.<br><a class="link-whatsapp" href="${dados.link}" target="_blank" rel="noopener noreferrer">Entrar no grupo do WhatsApp</a>`,
      'success'
    );
  } catch (erro) {
    mostrarMensagem('Não foi possível verificar o cadastro. Tente novamente.', 'error');
  }
}

form.addEventListener('submit', verificarCadastro);
carregarDados();
