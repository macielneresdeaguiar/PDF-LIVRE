# PDF Livre 📄

Ferramentas PDF sem limites de uso e sem cadastro — todo o processamento dos arquivos acontece no navegador. Nenhum PDF ou assinatura é enviado a servidor.

## Ferramentas

- 🔗 **Juntar PDF** — combine quantos arquivos quiser, arraste para ordenar; suporte a soltar PDFs em qualquer lugar e colar com Ctrl+V.
- 🗂️ **Organizar PDF** — reordene, gire, duplique e exclua páginas; misture vários PDFs (cada arquivo com sua cor); insira páginas em branco. O arrasto interno não é confundido com o drop de um arquivo.
- 🗜️ **Comprimir PDF** — 3 níveis de compressão.
- ✍️ **Assinar PDF** — várias pessoas no mesmo arquivo, assinaturas pelo nome com 4 caligrafias locais, desenho ou foto com remoção adaptativa de fundo. Biblioteca local de até **10 assinaturas**, seleção múltipla, posicionamento lado a lado, movimento/tamanho independentes e repetição em todas as páginas. Backup/importação e download de PNG transparente. Preserva o texto original e suporta páginas rotacionadas e recortadas.
- 🪄 **Corrigir PDF** — recupera a corrupção Wingdings/Print to PDF validada em DANFE/boletos brasileiros, redesenha áreas corrompidas e adiciona texto invisível copiável. Páginas sem texto usam OCR local com tesseract.js. Outros tipos de corrupção podem não ser recuperados automaticamente.

## Assinaturas: como usar

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
  signatures.js          # Biblioteca local, fotos e posicionamento/exportação
vendor/
  pdf-lib.min.js
  pdf.min.js
  pdf.worker.min.js
  fonts/                 # Allura, Great Vibes, Sacramento, Caveat + licenças SIL OFL
  tesseract/             # OCR e dados por/eng, todos locais
README.md
GUIA-ASSINATURAS.md
```

- [pdf-lib](https://pdf-lib.js.org/) — criação e edição de PDFs.
- [PDF.js](https://mozilla.github.io/pdf.js/) — renderização de miniaturas e páginas; versão 3.11.174 pareada com o worker.
- [tesseract.js](https://tesseract.projectnaptha.com/) — OCR local para páginas escaneadas; versão 5.1.1, `por+eng`, `gzip:false` para os arquivos `.traineddata` incluídos.
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
# com pymupdf e numpy instalados:
python3 tests/validate_pdfs.py
```

Atualização: 30/09/2026 — biblioteca de assinaturas e assinatura física sem fundo.
