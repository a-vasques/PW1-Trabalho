// Operações de texto feitas com comparações e laços simples.
function posicao(texto, trecho) {
  for (let i = 0; i <= texto.length - trecho.length; i++) {
    let j = 0;
    while (j < trecho.length && texto[i + j] === trecho[j]) j++;
    if (j === trecho.length) return i;
  }
  return -1;
}

function limpar(texto) {
  const espacos = " \t\n\r";
  let inicio = 0, fim = texto.length;
  while (inicio < fim && posicao(espacos, texto[inicio]) >= 0) inicio++;
  while (fim > inicio && posicao(espacos, texto[fim - 1]) >= 0) fim--;
  let resultado = "";
  for (let i = inicio; i < fim; i++) resultado += texto[i];
  return resultado;
}

function buscaSimples(texto) {
  const de = "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ";
  const para = "abcdefghijklmnopqrstuvwxyzaaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn";
  let resultado = "";
  for (const letra of texto) {
    const i = posicao(de, letra);
    resultado += i < 0 ? letra : para[i];
  }
  return resultado;
}

function imagemValida(url) {
  const inicios = ["https://", "http://", "data:image/png;base64,", "data:image/jpeg;base64,",
    "data:image/gif;base64,", "data:image/webp;base64,"];
  for (const inicio of inicios) if (posicao(url, inicio) === 0) return true;
  return false;
}

// Fetch API, REST e JWT: cada operação informa o método, o caminho e os dados.
const endereco = "https://ifsp.trojahn.uk/redesocial";
const chave = "orbita.sessao.v1";
let sessao = null;

function guardarSessao(valor) {
  sessao = valor;
  try {
    if (valor) sessionStorage.setItem(chave, JSON.stringify(valor));
    else sessionStorage.removeItem(chave);
  } catch (erro) {
    // O usuário ainda pode navegar com a sessão em memória.
  }
}

try {
  const salva = JSON.parse(sessionStorage.getItem(chave));
  if (salva && salva.token && salva.usuario && salva.usuario.id) sessao = salva;
} catch (erro) {
  guardarSessao(null);
}

async function requisitar(metodo, caminho, dados, autenticado) {
  const opcoes = { method: metodo, headers: {} };
  if (dados) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(dados);
  }
  if (autenticado) {
    if (!sessao) throw new Error("Entre na sua conta para continuar.");
    opcoes.headers.Authorization = "Bearer " + sessao.token;
  }
  const resposta = await fetch(endereco + caminho, opcoes);
  const resultado = await resposta.json();
  if (!resposta.ok) {
    const mensagem = resultado.msg || "O serviço não conseguiu concluir a operação.";
    if (autenticado && (resposta.status === 401 ||
        (resposta.status === 403 && posicao(buscaSimples(mensagem), "token") >= 0))) {
      guardarSessao(null);
      throw new Error("Sua sessão terminou. Entre novamente.");
    }
    if (metodo === "GET" && caminho === "/posts/" && resposta.status === 400 &&
        posicao(buscaSimples(mensagem), "nenhum") >= 0) return [];
    throw new Error(mensagem);
  }
  return resultado;
}
