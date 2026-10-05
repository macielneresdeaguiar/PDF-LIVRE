# PDF Livre 📄

Ferramentas PDF sem limites de uso e sem cadastro — todo o processamento dos arquivos acontece no navegador. Nenhum PDF ou assinatura é enviado a servidor.

## Ferramentas

- 🔗 **Juntar PDF** — combine quantos arquivos quiser, arraste para ordenar; suporte a soltar PDFs em qualquer lugar e colar com Ctrl+V.
- 🗂️ **Organizar PDF** — reordene, gire, duplique e exclua páginas; misture vários PDFs. A cor, o arquivo de origem e o número original da página são mantidos depois de mover. A posição no documento final é exibida separadamente.
- 🗜️ **Comprimir PDF** — 3 níveis de compressão.
- ✍️ **Assinar PDF** — vários PDFs de uma vez, baixados em **um único arquivo**; várias pessoas no mesmo lote, assinaturas pelo nome com 4 caligrafias locais, desenho ou foto com remoção adaptativa de fundo. Biblioteca local de até **10 assinaturas**, seleção múltipla, posicionamento lado a lado, movimento/tamanho independentes e repetição em todas as páginas. Backup/importação e download de PNG transparente. Repetição em todas as páginas ou na última página de cada PDF original; adicionar, remover e reordenar arquivos preservando as posições nas páginas de origem. Preserva o texto original e suporta páginas rotacionadas e recortadas.
- 📝 **Carta de Explicação** — 4 modelos baseados nos exemplos enviados (Loja do Vidraceiro, Qualieng, DR Utilidades e Djaci), dados da NF, descrição da nova situação, valor por extenso, revisão do texto, um ou dois espaços de assinatura, PDF paginado e envio direto para Assinar. Não reutiliza as assinaturas dos exemplos. A composição é local por modelo e dados informados, sem IA externa.
- 🗑️ **Excluir páginas** — seleção por miniaturas ou intervalos como `2, 4-6`, seleção reversível e bloqueio de PDF vazio. Baixa um novo arquivo, sem alterar o original e sem rasterizar as páginas mantidas.
- 🪄 **Corrigir PDF** — recupera a corrupção Wingdings/Print to PDF validada em DANFE/boletos brasileiros, redesenha áreas corrompidas e adiciona texto invisível copiável. Páginas sem texto usam OCR local com tesseract.js. Outros tipos de corrupção podem não ser recuperados automaticamente.

## Assinaturas: como usar

Veja também [GUIA-CARTAS-E-PAGINAS.md](GUIA-CARTAS-E-PAGINAS.md) e [COMO-PUBLICAR.md](COMO-PUBLICAR.md).

Leia [GUIA-ASSINATURAS.md](GUIA-ASSINATURAS.md) para assinar com Vanderson e Evandro Moreira no mesmo arquivo, fotografar uma assinatura no papel e guardar a biblioteca.

As assinaturas são **visuais**, sem certificado digital, convites remotos ou trilha de auditoria. Use somente assinaturas próprias ou autorizadas. Alterar um PDF já certificado pode invalidar a assinatura digital que ele contém.

### Persistência e privacidade

A biblioteca usa IndexedDB no navegador, com fallback para localStorage quando disponível. O limite de 10 é verificado também na gravação. Se ambos forem bloqueados, a biblioteca funciona em memória com aviso explícito para exportar o backup.

Dados ficam vinculados ao navegador/perfil/endereço do site; não há sincronização de servidor. Limpar dados ou usar modo anônimo pode apagá-los. Exporte um backup; o JSON contém as assinaturas e deve ser guardado com cuidado. Nenhuma assinatura pessoal acompanha o pacote do site.

## Tecnologia e estrutura

Site 100% estático, sem backend, banco de dados no servidor ou build:

```text
index.html
assets/
  signatures.css         # Interface e fontes de assinatura
  signatures.js          # Biblioteca, fotos, lote e posicionamento/exportação
  tools.css              # Cartas, exclusão e identificação de origem
  letters.js             # Modelos, redação por campos, revisão e PDF
  delete-pages.js         # Excluir páginas sem rasterizar
vendor/
  fontkit.min.js          # Incorporação local das fontes das cartas
  pdf-lib.min.js
  pdf.min.js
  pdf.worker.min.js
  fonts/                 # Assinaturas + Carlito regular/bold + licenças SIL OFL
  tesseract/             # OCR e dados por/eng, todos locais
README.md
GUIA-ASSINATURAS.md
GUIA-CARTAS-E-PAGINAS.md
COMO-PUBLICAR.md
```

- [pdf-lib](https://pdf-lib.js.org/) — criação e edição de PDFs.
- [PDF.js](https://mozilla.github.io/pdf.js/) — renderização de miniaturas e páginas; versão 3.11.174 pareada com o worker.
- [tesseract.js](https://tesseract.projectnaptha.com/) — OCR local para páginas escaneadas; versão 5.1.1, `por+eng`, `gzip:false` para os arquivos `.traineddata` incluídos.
- [@pdf-lib/fontkit](https://www.npmjs.com/package/@pdf-lib/fontkit) 1.1.1 — incorporação de Carlito regular/bold nas cartas. Fontes completas e ligaturas desativadas garantem leitura e cópia consistentes nos leitores PDF.
- Fontes [Google Fonts](https://github.com/google/fonts/tree/main/ofl) incluídas localmente sob SIL Open Font License 1.1, com as licenças de cada família na pasta `vendor/fonts/`.

Não depende de CDN. Toda leitura de imagem/PDF e remoção do papel é feita no dispositivo. A remoção adaptativa compensa variações moderadas de iluminação; não inventa traços nem garante bons resultados em fotos desfocadas, papel pautado ou sombras muito fortes.

## Rodar localmente

```bash
python3 -m http.server 3000 --bind 0.0.0.0
# abra http://localhost:3000
```

Sirva por HTTP/HTTPS para os workers e fontes funcionarem. A biblioteca é separada para cada origem/endereço.

## Deploy

Funciona em Render Static Site, GitHub Pages, Netlify, Vercel e outras hospedagens estáticas.

- **Publish directory:** `.` (raiz)
- **Build command:** nenhum
- Publique o conteúdo completo de `pdf-livre-site.zip`, incluindo **assets/** e **vendor/**.
- Não publique PDFs de teste, uploads pessoais ou backups de assinaturas.
- A prévia local não atualiza automaticamente `https://pdf-livre.onrender.com/`.

## Testes (no projeto de desenvolvimento)

O diretório `tests/` não é necessário para publicar e não é incluído no ZIP de produção. O teste de navegador cobre seleção múltipla, imagens independentes, fotos com sombra, persistência, backup, limite de 10, páginas rotacionadas, mobile e regressões de Juntar/Organizar/Comprimir/Corrigir.

```bash
npm install playwright
npx playwright install chromium
node tests/signatures.e2e.cjs
node tests/new-features.e2e.cjs
# com pymupdf e numpy instalados:
python3 tests/validate_pdfs.py
```

Atualização: 02/10/2026 — cartas, assinatura em lote, origem permanente das páginas e exclusão.

A publicação no Render é feita pelo repositório GitHub conectado. Siga `COMO-PUBLICAR.md` e publique o conteúdo completo do ZIP; não publique apenas o arquivo compactado. A biblioteca de assinaturas mantém o mesmo banco local da versão anterior. Os modelos originais assinados, uploads pessoais e testes não entram no pacote de produção.
