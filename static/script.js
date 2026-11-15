const SVG_NS = "http://www.w3.org/2000/svg";  // necessário para criar elementos SVG
const TAMANHO = 400;                           // largura/altura do gráfico em pixels
const ALCANCE = 10;                            // eixos vão de -10 a +10
const ESCALA = TAMANHO / (ALCANCE * 2);        // 20 pixels por unidade

const svg = document.getElementById("grafico");

// Converte coordenadas do gráfico (-10..10) em pixels da tela.
// O y é invertido porque na tela o 0 fica em cima e cresce para baixo.
function paraTela(x, y) {
  return {
    cx: TAMANHO / 2 + x * ESCALA,
    cy: TAMANHO / 2 - y * ESCALA,
  };
}

function desenharEixos() {
  const meio = TAMANHO / 2;
  const linhas = [
    [0, meio, TAMANHO, meio],  // horizontal
    [meio, 0, meio, TAMANHO],  // vertical
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


const tooltip = document.getElementById("tooltip");

const NOMES_METODO = {
  questionario: "Questionário",
  manual: "Posição direta",
};

// O servidor manda a data em UTC, às vezes sem o "Z" no final.
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
    linha("Método", NOMES_METODO[p.metodo] ?? p.metodo),
    linha("Cor", bolinha),
    linha("Criado em", lerData(p.criado_em).toLocaleString("pt-BR"))
  );
}

function posicionarTooltip(evento) {
  const margem = 14;
  let esquerda = evento.clientX + margem;
  let topo = evento.clientY + margem;

  // se a caixa passar da borda da janela, joga para o outro lado do mouse
  if (esquerda + tooltip.offsetWidth > window.innerWidth) {
    esquerda = evento.clientX - tooltip.offsetWidth - margem;
  }
  if (topo + tooltip.offsetHeight > window.innerHeight) {
    topo = evento.clientY - tooltip.offsetHeight - margem;
  }

  tooltip.style.left = `${esquerda}px`;
  tooltip.style.top = `${topo}px`;
}



function desenharPonto(participante) {
  const { cx, cy } = paraTela(participante.x, participante.y);

  const circulo = document.createElementNS(SVG_NS, "circle");
  circulo.setAttribute("cx", cx);
  circulo.setAttribute("cy", cy);
  circulo.setAttribute("r", 6);
  circulo.setAttribute("class", "ponto");
  circulo.style.fill = participante.cor;

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

async function carregar() {
  desenharEixos();
  const resposta = await fetch("/participantes");
  const participantes = await resposta.json();
  participantes.forEach(desenharPonto);
}

carregar();