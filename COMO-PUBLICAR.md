# Publicar a versão completa do PDF Livre

Versão de **21/10/2026** — inclui o novo módulo **Numerar páginas** e todas as ferramentas anteriores.

## 1. Extrair o ZIP

Baixe `pdf-livre-site.zip` e extraia o conteúdo. A estrutura correta é:

```text
index.html
assets/
vendor/
README.md
GUIA-ASSINATURAS.md
GUIA-CARTAS-E-PAGINAS.md
COMO-PUBLICAR.md
```

**Não publique só o ZIP e não mova os arquivos de `assets/` ou `vendor/` para a raiz.**

## 2. Atualizar o GitHub

1. Abra seu repositório **PDF-LIVRE** no GitHub.
2. Na raiz do projeto, clique em **Add file → Upload files**.
3. Arraste o `index.html`, os documentos e as pastas completas **assets/** e **vendor/** para a área de upload. Confirme que os caminhos das pastas foram mantidos.
4. Os arquivos com os mesmos nomes devem substituir a versão antiga. Inclua também os novos scripts, estilos e fontes.
5. No fim da página, escreva uma mensagem, por exemplo `Adicionar numeração sequencial de todas as páginas do PDF`.
6. Clique em **Commit changes**, na mesma branch usada pelo Render.

Não envie PDFs pessoais, os modelos já assinados, backups de assinaturas ou arquivos de teste. Eles não estão neste ZIP.

## 3. Publicar no Render

1. Entre no painel do Render e abra o serviço que publica o PDF Livre.
2. Se o deploy automático estiver habilitado, o novo commit deve iniciar a publicação.
3. Caso contrário, use **Manual Deploy → Deploy latest commit**.
4. Espere a publicação terminar com sucesso.
5. Para um serviço **Static Site**, mantenha:
   - **Publish directory:** `.`
   - **Build command:** vazio / sem comando.
6. Não é necessário instalar Node, Python, banco de dados ou backend na hospedagem.

## 4. Conferir no site

Abra `https://pdf-livre.onrender.com/` e pressione **Ctrl + Shift + R** para atualizar sem o cache antigo.

Verifique as ferramentas **Numerar**, **Carta**, **Assinar**, **Organizar** e **Excluir**. Em **Numerar**, abra um PDF e confira a sequência de 1 até a última página no arquivo baixado. Confirme que **assets/number-pages.js** foi publicado junto com o `index.html` e o `assets/tools.css` atualizados. Em Assinar, deve ser possível escolher vários PDFs; em Organizar, os cartões mostram **Página original** e **Posição no PDF** separadamente.

Se aparecer uma tela antiga, confirme que o Render publicou o commit mais recente. Se faltar alguma ferramenta ou fonte, confirme se `assets/` e `vendor/` foram enviados com todos os arquivos.

## Suas assinaturas salvas

A atualização não muda o nome do banco de assinaturas. No mesmo navegador, perfil e endereço do site, a biblioteca existente deve continuar disponível. Antes de publicar, é prudente usar **Exportar backup**. A prévia da área de trabalho e o endereço do Render são origens diferentes; para transferir uma biblioteca entre elas, exporte e importe o backup.

O pacote está pronto para publicação, mas a entrega do ZIP não atualiza automaticamente o GitHub nem o Render.
