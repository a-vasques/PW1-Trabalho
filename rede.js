const selecionar = function (seletor) { return document.querySelector(seletor); };
const painel = selecionar("#painel");
let posts = [], usuarios = [];
let vista = "Feed público", limite = 20;
let abertos = {}, rascunhos = {};
let ocupado = false, erroFeed = "";

function elemento(pai, tag, texto, classe) {
  const novo = document.createElement(tag);
  if (texto != null) novo.innerText = texto;
  if (classe) novo.classList.add(classe);
  pai.append(novo);
  return novo;
}

function aviso(texto) { selecionar("#aviso").innerText = texto; }

function botao(pai, texto, acao) {
  const b = elemento(pai, "button", texto);
  b.type = "button";
  b.addEventListener("click", function () { if (!ocupado) acao(); });
  return b;
}

function campo(pai, rotulo, tipo, valor, obrigatorio) {
  const label = elemento(pai, "label", rotulo);
  const input = elemento(label, tipo === "textarea" ? "textarea" : "input");
  if (tipo !== "textarea") input.type = tipo;
  input.value = valor || "";
  input.required = obrigatorio;
  return input;
}

function fechar() { painel.innerHTML = ""; painel.classList.add("oculto"); }

function abrir(titulo) {
  painel.innerHTML = "";
  painel.classList.remove("oculto");
  elemento(painel, "h2", titulo);
  const form = elemento(painel, "form");
  botao(painel, "Fechar", fechar);
  location.hash = "painel";
  return form;
}

async function executar(acao) {
  if (ocupado) return;
  const anterior = sessao;
  ocupado = true;
  try {
    await acao();
  } catch (erro) {
    aviso(erro.message || "Confira a conexão e tente novamente.");
  } finally {
    ocupado = false;
    if (anterior && !sessao) {
      rascunhos = {};
      fechar();
      mostrar();
    } else mostrarConta();
  }
}

function enviar(form, texto, acao) {
  const b = elemento(form, "button", texto);
  b.type = "submit";
  form.addEventListener("submit", function (evento) {
    evento.preventDefault();
    executar(acao);
  });
}

function foto(pai, pessoa) {
  const caixa = elemento(pai, "span", null, "autor");
  const nome = pessoa.nome || pessoa.login || "Usuário";
  const inicial = elemento(caixa, "span", nome[0], "iniciais");
  if (pessoa.img && imagemValida(pessoa.img)) {
    const img = elemento(caixa, "img", null, "foto");
    img.alt = "";
    img.addEventListener("error", function () { img.remove(); inicial.classList.remove("oculto"); });
    inicial.classList.add("oculto");
    img.src = pessoa.img;
  }
  elemento(caixa, "strong", nome);
}

function usuario(id) {
  for (const pessoa of usuarios) if (pessoa.id == id) return pessoa;
  if (sessao && sessao.usuario.id == id) return sessao.usuario;
  return {nome: "Usuário " + id};
}

function meu(item) { return sessao && sessao.usuario.id == item.usuario; }

function mostrarConta() {
  const conta = selecionar("#conta");
  conta.innerHTML = "";
  if (!sessao) {
    botao(conta, "Entrar", function () { acesso(false); });
    return;
  }
  botao(conta, sessao.usuario.nome || sessao.usuario.login, function () {
    const form = abrir("Minha conta");
    foto(form, sessao.usuario);
    elemento(form, "p", "@" + sessao.usuario.login);
    botao(form, "Sair da conta", function () {
      guardarSessao(null);
      rascunhos = {};
      fechar();
      mudarVista("Feed público");
      aviso("Você saiu da conta.");
    });
  });
}

function acesso(cadastro, loginInicial) {
  const form = abrir(cadastro ? "Criar conta" : "Entrar na Órbita");
  let nome, imagem;
  if (cadastro) nome = campo(form, "Nome", "text", "", true);
  const login = campo(form, "Usuário", "text", loginInicial, true);
  const senha = campo(form, "Senha", "password", "", true);
  if (cadastro) imagem = campo(form, "URL da foto de perfil (opcional)", "url", "", false);
  enviar(form, cadastro ? "Cadastrar" : "Entrar", async function () {
    const dados = {login: limpar(login.value), senha: senha.value};
    if (!dados.login) throw new Error("Informe seu usuário.");
    if (cadastro) {
      dados.nome = limpar(nome.value);
      if (!dados.nome) throw new Error("Informe seu nome.");
      dados.img = limpar(imagem.value);
      if (dados.img && !imagemValida(dados.img)) throw new Error("Informe um endereço válido para a foto.");
      await requisitar("POST", "/usuarios/", dados);
      acesso(false, dados.login);
      aviso("Conta criada. Entre com sua senha.");
    } else {
      const resposta = await requisitar("POST", "/usuarios/login", dados);
      let pessoa = resposta.usuario;
      if (!pessoa || !pessoa.id) {
        usuarios = await requisitar("GET", "/usuarios/");
        for (const u of usuarios) if (u.login === dados.login) pessoa = u;
      }
      if (!pessoa || !pessoa.id || !resposta.token) throw new Error("Não foi possível identificar a conta.");
      guardarSessao({token: resposta.token, usuario: {id:pessoa.id, login:dados.login, nome:pessoa.nome, img:pessoa.img}});
      fechar();
      aviso("Você entrou na Órbita.");
      await carregar();
    }
  });
  botao(form, cadastro ? "Já tenho conta" : "Criar uma conta", function () { acesso(!cadastro); });
}

function conectado() {
  if (sessao) return true;
  acesso(false);
  return false;
}

async function carregar() {
  try {
    const pessoas = await requisitar("GET", "/usuarios/");
    const lista = await requisitar("GET", "/posts/");
    usuarios = pessoas;
    posts = lista;
    erroFeed = "";
  } catch (erro) {
    erroFeed = "Não foi possível atualizar o feed. " + erro.message;
  }
  mostrar();
}

function editar(item, comentario) {
  if (!conectado()) return;
  const form = abrir(comentario ? "Editar comentário" : item ? "Editar publicação" : "Novo post");
  const texto = campo(form, "Texto", "textarea", item && item.texto, comentario);
  let imagem;
  if (!comentario) imagem = campo(form, "URL da imagem (opcional)", "url", item && item.img, false);
  enviar(form, item ? "Salvar alterações" : "Publicar", async function () {
    const dados = {texto: limpar(texto.value)};
    if (!comentario) dados.img = limpar(imagem.value);
    if (dados.img && !imagemValida(dados.img)) throw new Error("Informe um endereço válido para a imagem.");
    if (!dados.texto && !dados.img) throw new Error("Escreva um texto ou informe uma imagem.");
    const caminho = comentario ? "/comentarios/" : "/posts/";
    await requisitar(item ? "PUT" : "POST", caminho + (item ? item.id : ""), dados, true);
    fechar();
    if (!item) mudarVista("Feed público");
    aviso(item ? "Alterações salvas." : "Publicação enviada.");
    await carregar();
  });
}

function ferramentas(pai, item, comentario) {
  if (!meu(item)) return;
  const tipo = comentario ? "comentário" : "publicação";
  botao(pai, "Editar " + tipo, function () { editar(item, comentario); });
  botao(pai, "Excluir " + tipo, function () {
    const form = abrir("Excluir " + tipo + "?");
    elemento(form, "p", comentario ? "Remover este comentário da conversa?" : "Remover o post e suas interações?");
    botao(form, "Cancelar", fechar);
    enviar(form, "Excluir", async function () {
      await requisitar("DELETE", (comentario ? "/comentarios/" : "/posts/") + item.id, null, true);
      fechar();
      aviso("Exclusão concluída.");
      await carregar();
    });
  });
}

function autoria(pai, item) {
  foto(pai, usuario(item.usuario));
  elemento(pai, "small", (item.data || "") + (item.editado == 1 ? " · editado" : ""));
}

function conversa(pai, post) {
  if (post.comentarios.length === 0) elemento(pai, "p", "Ainda não há comentários.");
  for (const c of post.comentarios) {
    const bloco = elemento(pai, "div", null, "comentario");
    autoria(bloco, c);
    elemento(bloco, "p", c.texto, "texto");
    ferramentas(bloco, c, true);
  }
  if (!sessao) {
    botao(pai, "Entre para comentar", function () { acesso(false); });
    return;
  }
  const form = elemento(pai, "form");
  const texto = campo(form, "Seu comentário", "textarea", rascunhos[post.id], true);
  texto.addEventListener("input", function () { rascunhos[post.id] = texto.value; });
  enviar(form, "Comentar", async function () {
    if (!limpar(texto.value)) throw new Error("Escreva um comentário.");
    await requisitar("POST", "/posts/" + post.id + "/comentarios", {texto: limpar(texto.value)}, true);
    rascunhos[post.id] = "";
    aviso("Comentário publicado.");
    await carregar();
  });
}

function publicacao(pai, post) {
  const artigo = elemento(pai, "article");
  artigo.id = "post-" + post.id;
  autoria(artigo, post);
  if (post.texto) elemento(artigo, "p", post.texto, "texto");
  if (post.img && imagemValida(post.img)) {
    const img = elemento(artigo, "img", null, "imagem");
    img.alt = "Imagem da publicação";
    img.addEventListener("error", function () { img.remove(); elemento(artigo, "p", "Imagem indisponível."); });
    img.src = post.img;
  }
  ferramentas(artigo, post, false);
  let curtido = false;
  for (const like of post.likes) if (meu(like)) curtido = true;
  const curtir = botao(artigo, (curtido ? "Remover curtida" : "Curtir") + " (" + post.likes.length + ")", function () {
    if (conectado()) executar(async function () {
      await requisitar("POST", "/posts/" + post.id + "/likes", null, true);
      await carregar();
    });
  });
  if (curtido) curtir.classList.add("ativo");
  botao(artigo, "Comentários (" + post.comentarios.length + ")", function () {
    abertos[post.id] = !abertos[post.id];
    mostrarFeed();
  });
  if (abertos[post.id]) conversa(artigo, post);
}

// Ordenação por inserção. Em um empate nas curtidas aparece primeiro o post mais novo.
function ordenar(porCurtidas) {
  const lista = [];
  for (const post of posts) {
    let i = lista.length;
    while (i > 0) {
      const anterior = lista[i - 1];
      if (porCurtidas && anterior.likes.length !== post.likes.length) {
        if (anterior.likes.length > post.likes.length) break;
      } else if (anterior.id >= post.id) break;
      lista[i] = anterior;
      i--;
    }
    lista[i] = post;
  }
  return lista;
}

function mostrarFeed() {
  const feed = selecionar("#feed");
  feed.innerHTML = "";
  const busca = buscaSimples(limpar(selecionar("#busca").value));
  selecionar("#titulo").innerText = busca ? "Resultados da busca" : vista;
  if (erroFeed) {
    elemento(feed, "p", erroFeed);
    botao(feed, "Tentar novamente", function () { executar(carregar); });
  }
  let encontrados = 0;
  for (const post of ordenar(vista === "Em alta")) {
    const autor = usuario(post.usuario);
    const texto = (post.texto || "") + " " + autor.nome + " " + (autor.login || "");
    if (vista === "Meus posts" && !meu(post)) continue;
    if (posicao(buscaSimples(texto), busca) < 0) continue;
    encontrados++;
    if (encontrados <= limite) publicacao(feed, post);
  }
  if (!encontrados && !erroFeed) elemento(feed, "p", busca ? "Nenhum resultado para esta busca." : "Ainda não há publicações.");
  if (encontrados > limite) botao(feed, "Carregar mais", function () { limite += 20; mostrarFeed(); });
}

function mudarVista(nova) {
  vista = nova;
  limite = 20;
  selecionar("#busca").value = "";
  mostrar();
}

function mostrar() {
  if (!sessao && vista === "Meus posts") vista = "Feed público";
  mostrarConta();
  mostrarFeed();
  const radar = selecionar("#radar"), pessoas = selecionar("#pessoas");
  radar.innerHTML = "";
  pessoas.innerHTML = "";
  let quantidade = 0;
  for (const post of ordenar(true)) {
    if (quantidade === 3 || !post.likes.length) break;
    const linha = elemento(radar, "p");
    const link = elemento(linha, "a", (post.texto || "Publicação com imagem") + " (" + post.likes.length + ")");
    link.href = "#post-" + post.id;
    link.addEventListener("click", function () {
      mudarVista("Feed público");
      limite = posts.length;
      mostrarFeed();
    });
    quantidade++;
  }
  if (!quantidade) elemento(radar, "p", "Nenhuma publicação curtida.");
  const exibidos = {};
  quantidade = 0;
  for (const post of ordenar(false)) {
    if (exibidos[post.usuario]) continue;
    exibidos[post.usuario] = true;
    const pessoa = usuario(post.usuario);
    const linha = elemento(pessoas, "p");
    foto(linha, pessoa);
    if (pessoa.login) elemento(linha, "small", "@" + pessoa.login);
    quantidade++;
    if (quantidade === 4) break;
  }
  if (!quantidade) elemento(pessoas, "p", "Ainda não há autores no feed.");
}

selecionar("#marca").addEventListener("click", function () { mudarVista("Feed público"); });
selecionar("#publico").addEventListener("click", function () { mudarVista("Feed público"); });
selecionar("#alta").addEventListener("click", function () { mudarVista("Em alta"); });
selecionar("#meus").addEventListener("click", function () { if (conectado()) mudarVista("Meus posts"); });
selecionar("#novo").addEventListener("click", function () { if (!ocupado) editar(null, false); });
selecionar("#atualizar").addEventListener("click", function () { executar(carregar); });
selecionar("#busca").addEventListener("input", function () { limite = 20; mostrarFeed(); });
mostrarConta();
selecionar("#feed").innerText = "Carregando publicações…";
executar(carregar);


