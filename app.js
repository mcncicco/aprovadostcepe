const form = document.getElementById('formulario');
const nomeInput = document.getElementById('nome');
const nascimentoInput = document.getElementById('nascimento');
const telefoneInput = document.getElementById('telefone');
const resultado = document.getElementById('resultado');

let registros = [];

function normalizeText(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

  for (const linha of linhas) {
    let valorAtual = '';
    let emAspas = false;
    const linhaProcessada = [];

    for (let i = 0; i < linha.length; i += 1) {
      const caractere = linha[i];

      if (caractere === '"') {
        if (emAspas && linha[i + 1] === '"') {
          valorAtual += '"';
          i += 1;
        } else {
          emAspas = !emAspas;
        }
      } else if (caractere === ',' && !emAspas) {
        linhaProcessada.push(valorAtual);
        valorAtual = '';
      } else if ((caractere === '\n' || caractere === '\r') && !emAspas) {
        break;
      } else {
        valorAtual += caractere;
      }
    }

    linhaProcessada.push(valorAtual);
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

      const cabecalho = linhas[0].map((campo) => normalizeText(campo));
      const indiceNome = cabecalho.findIndex((campo) => campo.includes('nome'));
      const indiceData = cabecalho.findIndex((campo) => campo.includes('nascimento') || campo.includes('datanascimento'));
      const indiceLink = cabecalho.findIndex((campo) => campo.includes('link') || campo.includes('whatsapp') || campo.includes('grupo'));

      registros = linhas.slice(1).map((linha) => ({
        nome: linha[indiceNome] || '',
        nascimento: linha[indiceData] || '',
        link: linha[indiceLink] || ''
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
  const nascimento = nascimentoInput.value;
  const telefone = telefoneInput.value.trim();

  if (!nome || !nascimento || !telefone) {
    mostrarMensagem('Preencha nome, data de nascimento e telefone.', 'error');
    return;
  }

  try {
    const resposta = await fetch('/validar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nome,
        nascimento,
        telefone
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
