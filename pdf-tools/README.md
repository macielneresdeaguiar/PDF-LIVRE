# PDF Livre 📄

Ferramentas PDF sem limites, sem cadastro e 100% privadas — todo o processamento acontece no navegador. Nenhum arquivo é enviado a servidor.

## Ferramentas

- 🔗 **Juntar PDF** — combine quantos arquivos quiser, arraste para ordenar
- 🗂️ **Organizar PDF** — reordene, gire, duplique e exclua páginas; misture vários PDFs (cada arquivo com sua cor); insira páginas em branco
- 🗜️ **Comprimir PDF** — 3 níveis de compressão
- ✍️ **Assinar PDF** — desenhe, digite ou envie a imagem da assinatura e posicione em qualquer página

## Tecnologia

Site 100% estático: um único `index.html` + bibliotecas locais em `vendor/`:

- [pdf-lib](https://pdf-lib.js.org/) — criação e edição de PDFs
- [PDF.js](https://mozilla.github.io/pdf.js/) — renderização de miniaturas e páginas

Não há backend, banco de dados nem build — basta servir os arquivos.

## Rodar localmente

```bash
python3 -m http.server 3000
# abra http://localhost:3000
```

## Deploy

Funciona em qualquer hospedagem estática (Render Static Site, GitHub Pages, Netlify, Vercel...).

- **Publish directory:** `.` (raiz)
- **Build command:** nenhum
