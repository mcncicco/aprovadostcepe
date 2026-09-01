const form = document.getElementById('formulario');
const nomeInput = document.getElementById('nome');
const nascimentoInput = document.getElementById('nascimento');
const resultado = document.getElementById('resultado');
const submitButton = form.querySelector('button[type="submit"]');

const GRUPO_LINK = window.WHATSAPP_GROUP_LINK || 'https://chat.whatsapp.com/EEDDzjK4ODWBDPmkpJnf2Y';
let registros = [];
let carregandoDados = true;

function atualizarBotao() {
  if (!submitButton) return;
  submitButton.disabled = carregandoDados;
  submitButton.textContent = carregandoDados ? 'Carregando...' : 'Verificar';
}

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
  carregandoDados = true;
  atualizarBotao();

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
      carregandoDados = false;
      atualizarBotao();
    })
    .catch((erro) => {
      carregandoDados = false;
      atualizarBotao();
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

function validarLocalmente(nome, nascimento) {
  const pessoa = registros.find((registro) => {
    const nomeMatch = normalizeText(registro.nome) === normalizeText(nome);
    const dataMatch = normalizeDate(registro.nascimento) === nascimento;
    return nomeMatch && dataMatch;
  });

  if (!pessoa) {
    mostrarMensagem('Nenhuma pessoa encontrada com esses dados.', 'error');
    return;
  }

  mostrarMensagem(
    `Dados confirmados! Clique no link abaixo para entrar no grupo.<br><a class="link-whatsapp" href="${GRUPO_LINK}" target="_blank" rel="noopener noreferrer">Entrar no grupo do WhatsApp</a>`,
    'success'
  );
}

function podeUsarBackend() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function verificarCadastro(evento) {
  evento.preventDefault();

  if (carregandoDados) {
    mostrarMensagem('A lista está sendo carregada. Aguarde alguns instantes.', 'error');
    return;
  }

  const nome = nomeInput.value.trim();
  const nascimento = normalizeDate(nascimentoInput.value);

  if (!nome || !nascimento) {
    mostrarMensagem('Preencha nome e data de nascimento.', 'error');
    return;
  }

  if (!podeUsarBackend()) {
    validarLocalmente(nome, nascimento);
    return;
  }

  fetch('/validar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nome, nascimento })
  })
    .then(async (resposta) => {
      const dados = await resposta.json().catch(() => ({}));

      if (resposta.status === 405 || resposta.status === 404) {
        validarLocalmente(nome, nascimento);
        return;
      }

      if (!resposta.ok || !dados.ok) {
        mostrarMensagem(dados.message || 'Nenhuma pessoa encontrada com esses dados.', 'error');
        return;
      }

      mostrarMensagem(
        `Dados confirmados! Clique no link abaixo para entrar no grupo.<br><a class="link-whatsapp" href="${GRUPO_LINK}" target="_blank" rel="noopener noreferrer">Entrar no grupo do WhatsApp</a>`,
        'success'
      );
    })
    .catch(() => {
      validarLocalmente(nome, nascimento);
    });
}

form.addEventListener('submit', verificarCadastro);
atualizarBotao();
carregarDados();
