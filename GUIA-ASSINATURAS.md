# Assinaturas no PDF Livre

**Novidade:** selecione vários PDFs de uma vez e baixe um único arquivo com todas as páginas. Use `Adicionar PDFs` para ampliar o lote. Para repetir assinaturas no fim de cada arquivo, marque `Última página de cada PDF`. Consulte `GUIA-CARTAS-E-PAGINAS.md` para o fluxo completo.

## Vanderson e Evandro Moreira no mesmo arquivo

1. Abra **Assinar** no menu (ou **Assinar PDF** na tela inicial).
2. Em **Minhas assinaturas**, clique em **Nova assinatura**.
3. Informe **Vanderson**, escolha **Pelo nome**, selecione a caligrafia e a cor e clique em **Salvar assinatura**.
4. Faça o mesmo com **Evandro Moreira**. Use uma assinatura criada com o nome ou a foto autorizada da assinatura real de cada pessoa.
5. Abra o PDF. Marque as duas pessoas na biblioteca.
6. Clique em **Posicionar 2 selecionadas** e clique no local do PDF. As duas assinaturas entram lado a lado.
7. Arraste cada uma para sua linha de assinatura. O círculo roxo altera o tamanho; o **×** remove só aquela cópia.
8. Clique em **Baixar PDF assinado**. As duas assinaturas estarão no mesmo arquivo.

Você pode posicionar as pessoas em locais ou páginas diferentes: selecione só uma, coloque-a, depois selecione a outra. Trocar a seleção **não troca as marcas que já estão no PDF**.

Para repetir as assinaturas em todas as páginas, marque **Repetir em todas as páginas** antes de posicionar. Depois é possível ajustar ou remover cada cópia separadamente.

## Assinatura física fotografada, sem fundo

1. Assine em papel branco, de preferência com caneta preta ou azul escura.
2. Fotografe de frente, com boa luz e sem sombras fortes. Evite papel pautado.
3. Clique em **Nova assinatura**, informe o nome da pessoa e escolha **Foto do papel**.
4. Clique em **Escolher foto** ou **Usar câmera** (principalmente no celular). Também aceita soltar ou colar a foto na ferramenta.
5. Arraste sobre a foto para recortar só a região da assinatura. Use **Girar foto** se necessário.
6. Deixe **Remover fundo** ativado. Confira a prévia: o quadriculado é transparência, não faz parte da assinatura.
7. Ajuste **Limpeza** se restarem sombras ou se partes do traço desaparecerem. Você pode manter a cor original da tinta ou usar preta/azul. **Limpar pontinhos** elimina pequenas sujeiras; desligue se perder um detalhe muito pequeno.
8. Clique em **Salvar assinatura** e depois use-a no PDF como qualquer outra da biblioteca.

O processamento remove o papel e recorta os pixels da tinta; não inventa nem redesenha a assinatura. Fotos desfocadas, com sombras muito fortes ou com linhas do papel podem exigir um recorte melhor ou uma nova foto. Formatos aceitos: JPG, PNG e WebP; para HEIC, converta a foto para JPG.

## Até 10 assinaturas guardadas

- A biblioteca guarda **até 10 assinaturas**, incluindo as criadas pelo nome, desenhos e fotos.
- Elas ficam no navegador, associadas ao endereço do site. Não são enviadas para servidores.
- **Recomeçar lote** ou **Limpar posições** não apaga a biblioteca.
- Os ícones de cada assinatura permitem baixar um PNG transparente, renomear ou excluir.
- Excluir ou renomear uma assinatura salva não modifica as cópias que você já posicionou no PDF atual.
- Ao atingir 10, exclua uma para cadastrar outra.

### Não perca suas assinaturas

Use **Exportar backup** para guardar um arquivo de segurança. Em outro computador ou navegador, use **Importar backup**. O backup contém as imagens das assinaturas: guarde-o como um documento sensível.

Limpar os dados do navegador, trocar de navegador/dispositivo ou usar navegação anônima pode apagar ou separar a biblioteca. O endereço de teste e o endereço do Render têm bibliotecas independentes; use o backup para transferir. Em dispositivos compartilhados, outras pessoas que usam o mesmo perfil do navegador podem acessar as assinaturas.

Se o navegador bloquear o armazenamento, a ferramenta mostra um aviso: nesse caso as assinaturas duram só até fechar/recarregar a sessão. Exporte um backup antes de sair.

## O que este recurso faz — e o que não faz

Insere **assinaturas visuais** no PDF, preservando o conteúdo original e a seleção do texto (não converte o documento inteiro em imagem). Não cria uma assinatura criptográfica, certificado ICP-Brasil, trilha de auditoria ou fluxo de convites por e-mail. Use somente assinaturas próprias ou com autorização do titular. Adicionar marcas a um PDF que já tem assinatura digital certificada pode invalidar a certificação existente.

## Atualizar a hospedagem

O pacote `pdf-livre-site.zip` inclui `index.html`, `assets/`, `vendor/`, `README.md`, `GUIA-CARTAS-E-PAGINAS.md`, `COMO-PUBLICAR.md` e este guia. Publique todos esses arquivos, mantendo as pastas, no mesmo projeto estático do Render. Não basta atualizar só o HTML: os scripts, estilos e fontes de assinatura estão nas pastas incluídas.

A implementação deste pacote precisa ser publicada para aparecer em `https://pdf-livre.onrender.com/`; a prévia da área de trabalho não atualiza esse endereço automaticamente.
