// =====================================================================
// 1. CONFIGURAÇÃO E ESTADO
// =====================================================================
const SVG_NS = "http://www.w3.org/2000/svg";
const TAMANHO = 400;
const ALCANCE = 10;
const ESCALA = TAMANHO / (ALCANCE * 2);

const APELIDO_RE = /^[A-Za-z0-9_]{3,20}$/;
const TAG_RE = /^[A-Za-z0-9]{4}$/;

const OPCOES = [
  { valor: 1, texto: "Discordo totalmente" },
  { valor: 2, texto: "Discordo" },
  { valor: 3, texto: "Neutro" },
  { valor: 4, texto: "Concordo" },
  { valor: 5, texto: "Concordo totalmente" },
];

// Elementos da página
const svg = document.getElementById("grafico");
const tooltip = document.getElementById("tooltip");
const modal = document.getElementById("modal");
const btnParticipar = document.getElementById("btn-participar");
const tituloIdentidade = document.getElementById("titulo-identidade");
const avisoEdicao = document.getElementById("aviso-edicao");
const campoApelido = document.getElementById("campo-apelido");
const campoTag = document.getElementById("campo-tag");
const campoCor = document.getElementById("campo-cor");
const erroIdentidade = document.getElementById("erro-identidade");
const barra = document.getElementById("barra");
const contador = document.getElementById("contador");
const textoPergunta = document.getElementById("texto-pergunta");
const opcoes = document.getElementById("opcoes");
const erroEnvio = document.getElementById("erro-envio");
const btnEnviar = document.getElementById("btn-enviar");

// Estado do programa
let participantes = [];   // pontos que estão no gráfico
let perguntas = [];       // perguntas carregadas da API
let respostas = {};       // { idDaPergunta: valor de 1 a 5 }
let indice = 0;           // pergunta atual
let modoEdicao = false;   // true se a pessoa já participou antes


// =====================================================================
// 2. IDENTIDADE GUARDADA NO NAVEGADOR (id + token)
// =====================================================================
const CHAVE_IDENTIDADE = "mapa_identidade";

function lerIdentidade() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_IDENTIDADE));
  } catch {
    return null;
  }
}

function salvarIdentidade(dados) {
  try {
    localStorage.setItem(CHAVE_IDENTIDADE, JSON.stringify(dados));
  } catch {}
}

function limparIdentidade() {
  try {
    localStorage.removeItem(CHAVE_IDENTIDADE);
  } catch {}
}


// =====================================================================
// 3. GRÁFICO
// =====================================================================
function paraTela(x, y) {
  return {
    cx: TAMANHO / 2 + x * ESCALA,
    cy: TAMANHO / 2 - y * ESCALA,
  };
}

function desenharEixos() {
  const meio = TAMANHO / 2;
  const linhas = [
    [0, meio, TAMANHO, meio],
    [meio, 0, meio, TAMANHO],
  ];
  for (const [x1, y1, x2, y2] of linhas) {
    const linha = document.createElementNS(SVG_NS, "line");
    linha.setAttribute("x1", x1);
    linha.setAttribute("y1", y1);
    linha.setAttribute("x2", x2);
    linha.setAttribute("y2", y2);
    linha.setAttribute("class", "eixo");
    svg.appendChild(linha);
  }
}

function desenharPonto(participante, meuId, idNovo) {
  const { cx, cy } = paraTela(participante.x, participante.y);

  const circulo = document.createElementNS(SVG_NS, "circle");
  circulo.setAttribute("cx", cx);
  circulo.setAttribute("cy", cy);
  circulo.setAttribute("r", 6);
  circulo.setAttribute("class", "ponto");
  circulo.style.fill = participante.cor;

  if (participante.id === meuId) circulo.classList.add("meu");
  if (participante.id === idNovo) circulo.classList.add("novo");

  circulo.addEventListener("mouseenter", (evento) => {
    montarTooltip(participante);
    tooltip.hidden = false;
    posicionarTooltip(evento);
  });
  circulo.addEventListener("mousemove", posicionarTooltip);
  circulo.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
  });

  svg.appendChild(circulo);
}

// Busca os pontos na API e redesenha todos
async function carregarPontos(idNovo = null) {
  try {
    const resposta = await fetch("/participantes");
    participantes = await resposta.json();
  } catch {
    return;
  }

  svg.querySelectorAll(".ponto").forEach((ponto) => ponto.remove());

  const identidade = lerIdentidade();
  const meuId = identidade ? identidade.id : null;
  participantes.forEach((p) => desenharPonto(p, meuId, idNovo));
}


// =====================================================================
// 4. CAIXINHA DO HOVER
// =====================================================================
function lerData(texto) {
  const temFuso = /[zZ]|[+-]\d\d:\d\d$/.test(texto);
  return new Date(temFuso ? texto : texto + "Z");
}

function linha(rotulo, valor) {
  const div = document.createElement("div");
  div.className = "linha";
  const esquerda = document.createElement("span");
  esquerda.textContent = rotulo;
  const direita = document.createElement("span");
  if (valor instanceof Node) {
    direita.appendChild(valor);
  } else {
    direita.textContent = valor;
  }
  div.append(esquerda, direita);
  return div;
}

function montarTooltip(p) {
  const titulo = document.createElement("strong");
  titulo.textContent = `${p.apelido}#${p.tag}`;

  const bolinha = document.createElement("span");
  bolinha.className = "cor";
  bolinha.style.background = p.cor;

  tooltip.replaceChildren(
    titulo,
    linha("Posição", `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`),
    linha("Cor", bolinha),
    linha("Criado em", lerData(p.criado_em).toLocaleString("pt-BR"))
  );
}

function posicionarTooltip(evento) {
  const margem = 14;
  let esquerda = evento.clientX + margem;
  let topo = evento.clientY + margem;

  if (esquerda + tooltip.offsetWidth > window.innerWidth) {
    esquerda = evento.clientX - tooltip.offsetWidth - margem;
  }
  if (topo + tooltip.offsetHeight > window.innerHeight) {
    topo = evento.clientY - tooltip.offsetHeight - margem;
  }

  tooltip.style.left = `${esquerda}px`;
  tooltip.style.top = `${topo}px`;
}


// =====================================================================
// 5. MODAL: CONTROLE DAS ETAPAS
// =====================================================================
function mostrarEtapa(nome) {
  for (const id of ["etapa-identidade", "etapa-perguntas", "etapa-envio"]) {
    document.getElementById(id).hidden = id !== nome;
  }
}

function abrirModal() {
  tooltip.hidden = true;

  const identidade = lerIdentidade();
  modoEdicao = identidade !== null;

  // começa sempre do zero
  perguntas = [];
  respostas = {};
  indice = 0;
  erroIdentidade.hidden = true;
  erroEnvio.hidden = true;

  if (modoEdicao) {
    tituloIdentidade.textContent = "Refazer o questionário";
    avisoEdicao.textContent =
      `Você participa como ${identidade.apelido}#${identidade.tag}. ` +
      "Responder de novo atualiza o seu ponto.";
    avisoEdicao.hidden = false;
    campoApelido.value = identidade.apelido;
    campoTag.value = identidade.tag;

    const meuPonto = participantes.find((p) => p.id === identidade.id);
    if (meuPonto) campoCor.value = meuPonto.cor;
  } else {
    tituloIdentidade.textContent = "Participar do mapa";
    avisoEdicao.hidden = true;
    campoApelido.value = "";
    campoTag.value = "";
  }
  campoApelido.disabled = modoEdicao;
  campoTag.disabled = modoEdicao;

  mostrarEtapa("etapa-identidade");
  modal.showModal();
}

function voltarParaIdentidade(mensagem) {
  erroIdentidade.textContent = mensagem;
  erroIdentidade.hidden = false;
  mostrarEtapa("etapa-identidade");
}


// ---------- Etapa 1: identidade ----------
async function comecar() {
  erroIdentidade.hidden = true;

  if (!modoEdicao) {
    const apelido = campoApelido.value.trim();
    const tag = campoTag.value.trim();

    if (!APELIDO_RE.test(apelido)) {
      voltarParaIdentidade("Apelido: 3 a 20 caracteres (letras, números e _).");
      return;
    }
    if (tag !== "" && !TAG_RE.test(tag)) {
      voltarParaIdentidade("A tag precisa ter exatamente 4 letras ou números.");
      return;
    }
  }

  // só busca as perguntas se ainda não tiver (assim, ao voltar, as respostas não se perdem)
  if (perguntas.length === 0) {
    try {
      const resposta = await fetch("/perguntas");
      perguntas = await resposta.json();
    } catch {
      voltarParaIdentidade("Não foi possível carregar as perguntas. Tente de novo.");
      return;
    }
  }

  indice = 0;
  mostrarEtapa("etapa-perguntas");
  mostrarPergunta();
}

// ----- Nomes dos extremos (edite à vontade) -----
const ROTULOS = {
  topo: "Ryan Carvalho",
  base: "Ghost",
  esquerda: "Derek Wokatron3000",
  direita: "Bolsohenrique",
};

function criar(tag, atributos, texto) {
  const elemento = document.createElementNS(SVG_NS, tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    elemento.setAttribute(nome, valor);
  }
  if (texto !== undefined) elemento.textContent = texto;
  svg.appendChild(elemento);
  return elemento;
}

function desenharRotulos() {
  const meio = TAMANHO / 2;

  criar("text", { x: meio, y: -10, "text-anchor": "middle", class: "rotulo" }, ROTULOS.topo);
  criar("text", { x: meio, y: TAMANHO + 20, "text-anchor": "middle", class: "rotulo" }, ROTULOS.base);

  // os rótulos laterais são girados para caberem na margem
  const esq = -10;
  const dir = TAMANHO + 10;
  criar("text", {
    x: esq, y: meio, "text-anchor": "middle",
    transform: `rotate(-90 ${esq} ${meio})`, class: "rotulo",
  }, ROTULOS.esquerda);
  criar("text", {
    x: dir, y: meio, "text-anchor": "middle",
    transform: `rotate(90 ${dir} ${meio})`, class: "rotulo",
  }, ROTULOS.direita);
}

// ---------- Etapa 2: perguntas ----------
function mostrarPergunta() {
  const pergunta = perguntas[indice];

  textoPergunta.textContent = pergunta.texto;
  contador.textContent = `Pergunta ${indice + 1} de ${perguntas.length}`;
  barra.style.width = `${(indice / perguntas.length) * 100}%`;

  opcoes.replaceChildren();
  for (const opcao of OPCOES) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "opcao";
    botao.textContent = opcao.texto;
    if (respostas[pergunta.id] === opcao.valor) botao.classList.add("marcada");
    botao.addEventListener("click", () => responder(pergunta.id, opcao.valor));
    opcoes.appendChild(botao);
  }
}

function responder(idPergunta, valor) {
  respostas[idPergunta] = valor;
  indice += 1;

  if (indice < perguntas.length) {
    mostrarPergunta();
  } else {
    barra.style.width = "100%";
    erroEnvio.hidden = true;
    mostrarEtapa("etapa-envio");
  }
}

function voltarPergunta() {
  if (indice > 0) {
    indice -= 1;
    mostrarPergunta();
  } else {
    mostrarEtapa("etapa-identidade");
  }
}

function voltarDoEnvio() {
  indice = perguntas.length - 1;
  mostrarEtapa("etapa-perguntas");
  mostrarPergunta();
}


// ---------- Etapa 3: envio ----------
function mostrarErroEnvio(mensagem) {
  erroEnvio.textContent = mensagem;
  erroEnvio.hidden = false;
}

async function tratarErro(resposta) {
  let detalhe = null;
  try {
    detalhe = (await resposta.json()).detail;
  } catch {}

  if (resposta.status === 409) {
    voltarParaIdentidade("Essa combinação de apelido e tag já está em uso. Escolha outra.");
  } else if (resposta.status === 422) {
    const mensagem = Array.isArray(detalhe)
      ? detalhe[0].msg.replace("Value error, ", "")
      : "Dados inválidos.";
    voltarParaIdentidade(mensagem);
  } else if (resposta.status === 403) {
    limparIdentidade();
    mostrarErroEnvio(
      "Sua participação anterior não foi encontrada. " +
      "Feche esta janela e clique em Participar para entrar de novo."
    );
  } else {
    mostrarErroEnvio("Algo deu errado. Tente de novo.");
  }
}

async function enviar() {
  btnEnviar.disabled = true;
  erroEnvio.hidden = true;

  const lista = Object.entries(respostas).map(([id, valor]) => ({
    pergunta: Number(id),
    valor: valor,
  }));
  const cor = campoCor.value;

  try {
    let resposta;

    if (modoEdicao) {
      const identidade = lerIdentidade();
      resposta = await fetch(`/participantes/${identidade.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Token": identidade.token },
        body: JSON.stringify({ cor: cor, respostas: lista }),
      });
    } else {
      const tag = campoTag.value.trim();
      resposta = await fetch("/participantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apelido: campoApelido.value.trim(),
          tag: tag === "" ? null : tag,
          cor: cor,
          respostas: lista,
        }),
      });
    }

    if (!resposta.ok) {
      await tratarErro(resposta);
      return;
    }

    const dados = await resposta.json();

    // na criação, a API devolve o token; guardamos para poder editar depois
    if (!modoEdicao) {
      salvarIdentidade({
        id: dados.id,
        token: dados.token,
        apelido: dados.apelido,
        tag: dados.tag,
      });
    }

    modal.close();
    await carregarPontos(dados.id);
  } catch {
    mostrarErroEnvio("Sem conexão com o servidor. Tente de novo.");
  } finally {
    btnEnviar.disabled = false;
  }
}


// =====================================================================
// 6. LIGANDO OS EVENTOS E INICIANDO
// =====================================================================
btnParticipar.addEventListener("click", abrirModal);
document.getElementById("modal-fechar").addEventListener("click", () => modal.close());
document.getElementById("btn-comecar").addEventListener("click", comecar);
document.getElementById("btn-voltar").addEventListener("click", voltarPergunta);
document.getElementById("btn-voltar-envio").addEventListener("click", voltarDoEnvio);
btnEnviar.addEventListener("click", enviar);

desenharEixos();
carregarPontos();
desenharRotulos();