const form = document.getElementById('formulario');
const nomeInput = document.getElementById('nome');
const nascimentoInput = document.getElementById('nascimento');
const resultado = document.getElementById('resultado');

const GRUPO_LINK = window.WHATSAPP_GROUP_LINK || 'https://chat.whatsapp.com/KkRoWs68ZBCGCBOJFSxArB';
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
  let cargoAtual = '';

  for (const linha of linhas) {
    const linhaTrim = linha.trim();

    if (linhaTrim.startsWith('#CARGO#')) {
      cargoAtual = linhaTrim.replace(/^#CARGO#/, '').trim();
      continue;
    }

    const linhaProcessada = linhaTrim.split(delimitador).map((valor) => valor.trim());

    if (linhaProcessada.length < 3) {
      continue;
    }

    registrosCSV.push({
      cargo: cargoAtual,
      nome: linhaProcessada[1] || '',
      nascimento: linhaProcessada[2] || ''
    });
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

      if (linhas.length === 0) {
        throw new Error('O arquivo CSV está vazio.');
      }

      registros = linhas;
    })
    .catch((erro) => {
      mostrarMensagem(
        `Não foi possível carregar a base de dados. ${erro.message}`,
        'error'
      );
    });
}

function formatarDataInput(valor = '') {
  const apenasDigitos = valor.replace(/\D/g, '').slice(0, 8);

  if (apenasDigitos.length <= 2) {
    return apenasDigitos;
  }

  if (apenasDigitos.length <= 4) {
    return `${apenasDigitos.slice(0, 2)}/${apenasDigitos.slice(2)}`;
  }

  return `${apenasDigitos.slice(0, 2)}/${apenasDigitos.slice(2, 4)}/${apenasDigitos.slice(4)}`;
}

function mostrarMensagem(mensagem, tipo = 'success') {
  resultado.classList.add('visible', tipo);
  resultado.innerHTML = mensagem;
}

nascimentoInput.addEventListener('input', (evento) => {
  evento.target.value = formatarDataInput(evento.target.value);
});

function verificarCadastro(evento) {
  evento.preventDefault();

  const nome = nomeInput.value.trim();
  const nascimento = normalizeDate(nascimentoInput.value);

  if (!nome || !nascimento) {
    mostrarMensagem('Preencha nome e data de nascimento.', 'error');
    return;
  }

  const pessoa = registros.find((registro) => {
    const nomeMatch = normalizeText(registro.nome) === normalizeText(nome);
    const dataMatch = normalizeDate(registro.nascimento) === nascimento;
    return nomeMatch && dataMatch;
  });

  if (!pessoa) {
    mostrarMensagem('Nenhuma pessoa encontrada com esses dados.', 'error');
    return;
  }

  const cargo = pessoa.cargo || 'cargo não informado';
  const mensagem = `Olá Pessoal, me chamo "${nome}" e fui aprovado para o cargo ${cargo}.`;
  const separador = GRUPO_LINK.includes('?') ? '&' : '?';
  const linkWhatsapp = `${GRUPO_LINK}${separador}text=${encodeURIComponent(mensagem)}`;

  mostrarMensagem(
    `Dados confirmados! Clique no link abaixo para entrar no grupo.<br><a class="link-whatsapp" href="${linkWhatsapp}" target="_blank" rel="noopener noreferrer">Entrar no grupo do WhatsApp</a>`,
    'success'
  );
}

form.addEventListener('submit', verificarCadastro);
carregarDados();
