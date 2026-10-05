/* Cartas locais baseadas nos quatro modelos fornecidos pelo usuário.
   Não reutiliza imagens/assinaturas dos PDFs de referência nem inventa fatos.
   A composição é por modelo + dados informados, sem serviços de IA externos. */
'use strict';
const LETTER_MODELS={
  vidraceiro:{name:'Compra emergencial · Loja do Vidraceiro',source:'Carta de Explicação NF 4699 Loja do Vidraceiro_signed.pdf',supplier:'V.A. Loja do Vidraceiro',kind:'compra',object:'aquisição de roldanas para a porta de vidro da recepção',reason:'A compra foi realizada em caráter emergencial, pois as roldanas da porta de vidro da recepção estavam danificadas. A situação representava risco de queda de uma das folhas de vidro, comprometendo a segurança dos condôminos, visitantes e colaboradores.',context:''},
  qualieng:{name:'Serviço emergencial · Qualieng',source:'Carta de Explicação NF 55 Qualieng_signed.pdf',supplier:'Qualieng Serviços de Engenharia Ltda.',kind:'servico',object:'substituição de peças e reabastecimento de gás dos aparelhos de ar-condicionado do auditório',reason:'O serviço precisou ser executado em caráter emergencial. Os aparelhos de ar-condicionado do auditório não estavam funcionando adequadamente, impossibilitando a reserva e a utilização do espaço até que o problema fosse solucionado.',context:'A empresa responsável pela execução do serviço e pela aquisição das peças já presta serviços ao condomínio, realizando trimestralmente a manutenção e a limpeza dos aparelhos de ar-condicionado. Por já conhecer os equipamentos e as instalações do local, a empresa pôde realizar o atendimento com maior rapidez.'},
  dr:{name:'Materiais sob demanda · DR Utilidades',source:'Carta de Explicação NF 71 DR Utilidades_assinado.pdf',supplier:'DR UTILIDADES PARA O LAR LTDA',kind:'materiais',object:'materiais utilizados pela equipe de manutenção',reason:'Os materiais são requisitados em caráter emergencial, devido a acontecimentos fora da rotina. A aquisição é necessária para atender às demandas da equipe de manutenção.',context:'O fornecedor vende os materiais mediante requisição e entrega sob demanda. Ao final do mês, é emitida uma nota fiscal referente aos materiais comprados ao longo do período.'},
  djaci:{name:'Materiais sob demanda · Djaci',source:'Carta de Explicação NF 221 Djaci_signed.pdf',supplier:'DJACI MARTINS BEZERRA UTILIDADES PARA O LAR',kind:'materiais',object:'materiais utilizados pela equipe de manutenção',reason:'Os materiais são requisitados em caráter emergencial, devido a acontecimentos fora da rotina. A aquisição é necessária para atender às demandas da equipe de manutenção.',context:'O fornecedor vende os materiais mediante requisição e entrega sob demanda. Ao final do mês, é emitida uma nota fiscal referente aos materiais comprados ao longo do período.'}
};
const LETTER_PREF_KEY='pdf-livre.cartas.dados-fixos.v1';
const LETTER_FIXED_IDS=['entity','cnpj','city','signer','role','signer2','role2'];
let letterCurrentModel='vidraceiro',letterPdfBytes=null,letterDraft=null,letterFieldsDirty=false,letterEditorDirty=false,letterGenerating=false,letterFontPromise=null;
function letterValue(id){return $('#letter-'+id).value.trim();}
function letterSetStatus(text,style=''){const el=$('#letter-status');el.textContent=text;el.className='form-note'+(style?' '+style:'');}
function letterSetActions(){const disabled=!letterPdfBytes||letterFieldsDirty||letterEditorDirty||letterGenerating;$('#letter-download').disabled=disabled;$('#letter-send-sign').disabled=disabled;$('#letter-apply-edit').disabled=!letterDraft||letterFieldsDirty||!letterEditorDirty||letterGenerating;$('#letter-generate').disabled=letterGenerating;$('#letter-generate').textContent=letterGenerating?'Gerando…':'Gerar carta para revisar →';}
function letterMarkChanged(){if(letterDraft){letterFieldsDirty=true;letterSetStatus('Dados alterados. Gere a carta novamente para atualizar a prévia e o download.','stale');}letterSetActions();}
function letterChooseModel(){const previous=LETTER_MODELS[letterCurrentModel];letterCurrentModel=$('#letter-model').value;const model=LETTER_MODELS[letterCurrentModel];if(!letterValue('supplier')||letterValue('supplier')===previous.supplier)$('#letter-supplier').value=model.supplier;$('#letter-model-note').textContent='Referência: '+model.source+'. A nova NF, o valor e a situação são os dados que você informar abaixo.';$('#letter-object').placeholder='Ex.: '+model.object;letterMarkChanged();}
function letterUseExample(){if(letterValue('reason')&&!confirm('Substituir a descrição atual pelo texto de exemplo deste modelo? Depois revise para a sua situação real.'))return;const m=LETTER_MODELS[letterCurrentModel];$('#letter-object').value=m.object;$('#letter-reason').value=m.reason;$('#letter-context').value=m.context;$('#letter-quotes').checked=true;letterMarkChanged();toast('Texto de exemplo carregado. Informe a nova NF/valor e revise a situação antes de gerar.');}
function letterToggleSecondSigner(){const on=$('#letter-second').checked;$('#letter-second-fields').hidden=!on;$('#letter-signer2').required=on;letterMarkChanged();letterSaveFixed();}
function letterSaveFixed(){try{const data={};LETTER_FIXED_IDS.forEach(id=>data[id]=letterValue(id));data.second=$('#letter-second').checked;localStorage.setItem(LETTER_PREF_KEY,JSON.stringify(data));$('#letter-prefs-note').textContent='Dados fixos salvos neste navegador. As assinaturas dos PDFs de exemplo não são reutilizadas.';}catch(_){$('#letter-prefs-note').textContent='O navegador bloqueou o salvamento dos dados fixos; preencha novamente na próxima sessão. Nenhuma assinatura dos exemplos é reutilizada.';}}
function letterIdentifyFacts(){
  const text=letterValue('reason'),found=[];
  const nf=text.match(/\b(?:NF|nota\s+fiscal)\s*(?:n[ºo°.]*\s*)?[:=\-]?\s*(\d[\d.\/-]*)/i);
  const supplier=text.match(/(?:empresa|fornecedor)\s*[:=]\s*([^;\n]+)/i);
  const value=text.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i)||text.match(/valor\s*[:=]\s*([\d.,]+)/i);
  if(nf){$('#letter-nf').value=nf[1].slice(0,40);found.push('NF');}if(supplier){$('#letter-supplier').value=supplier[1].trim().slice(0,220);found.push('empresa');}if(value){$('#letter-value').value=value[1];found.push('valor');}
  const reason=text.match(/(?:motivo|justificativa|situa[cç][aã]o|o que mudou)\s*[:=]\s*([\s\S]+)/i);
  if(reason){$('#letter-reason').value=reason[1].trim();found.push('motivo');}
  letterMarkChanged();toast(found.length?'Identifiquei '+found.join(', ')+'. Confira os campos e o texto.':'Use, por exemplo: NF: 123; Empresa: nome; Valor: R$ 100,00; Motivo: sua explicação.',!found.length);
}
function letterParseMoney(text){
  if(!text)return null;let s=text.replace(/R\$/gi,'').replace(/\s/g,'');if(!/^[\d.,]+$/.test(s))throw new Error('Valor inválido. Use, por exemplo, 1.600,00.');
  let integer,fraction='00';
  if(s.includes(',')){const parts=s.split(',');if(parts.length!==2||!/^\d{1,2}$/.test(parts[1]))throw new Error('Valor inválido. Use duas casas decimais, por exemplo 56,90.');integer=parts[0].replace(/\./g,'');fraction=parts[1].padEnd(2,'0');}
  else if(/^\d+\.\d{1,2}$/.test(s)){[integer,fraction]=s.split('.');fraction=fraction.padEnd(2,'0');}
  else integer=s.replace(/\./g,'');
  if(!/^\d+$/.test(integer))throw new Error('Valor inválido.');const cents=Number(integer)*100+Number(fraction);if(!Number.isSafeInteger(cents)||cents>99999999999)throw new Error('Informe um valor até R$ 999.999.999,99.');return cents;
}
function letterSmallNumber(n){
  const units=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const tens=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];const hundreds=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  if(n<20)return units[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' e '+units[n%10]:'');if(n===100)return 'cem';return hundreds[Math.floor(n/100)]+(n%100?' e '+letterSmallNumber(n%100):'');
}
function letterIntegerWords(n){
  if(n<1000)return letterSmallNumber(n);const groups=[];const millions=Math.floor(n/1000000),thousands=Math.floor(n/1000)%1000,rest=n%1000;
  if(millions)groups.push(letterSmallNumber(millions)+(millions===1?' milhão':' milhões'));if(thousands)groups.push(thousands===1?'mil':letterSmallNumber(thousands)+' mil');if(rest)groups.push(letterSmallNumber(rest));return groups.join(' e ');
}
function letterMoneyWords(cents){const reais=Math.floor(cents/100),coins=cents%100;let text=reais?letterIntegerWords(reais)+(reais===1?' real':reais%1000000===0?' de reais':' reais'):'';if(coins)text+=(text?' e ':'')+letterSmallNumber(coins)+(coins===1?' centavo':' centavos');return text||'zero reais';}
function letterFormatMoney(cents){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100).replace(/\u00a0/g,' ');}
function letterParagraph(text){const s=text.trim().replace(/[ \t]+/g,' ').replace(/\n(?!\s*\n)/g,' ');return s? s[0].toLocaleUpperCase('pt-BR')+s.slice(1)+(/[.!?;:]$/.test(s)?'':'.'):'';}
function letterReadFields(){
  const fields={model:letterCurrentModel,nf:letterValue('nf'),supplier:letterValue('supplier'),object:letterValue('object'),reason:letterValue('reason'),context:letterValue('context'),entity:letterValue('entity'),cnpj:letterValue('cnpj'),city:letterValue('city'),signer:letterValue('signer'),role:letterValue('role'),signer2:letterValue('signer2'),role2:letterValue('role2'),second:$('#letter-second').checked,quotes:$('#letter-quotes').checked,extenso:$('#letter-extenso').checked,includeDate:$('#letter-date-enabled').checked,date:letterValue('date'),cents:letterParseMoney(letterValue('value'))};
  for(const[id,label]of [['nf','número da nota fiscal'],['supplier','empresa/fornecedor'],['reason','descrição do que aconteceu'],['entity','condomínio/entidade'],['signer','nome de quem vai assinar']])if(!fields[id])throw new Error('Preencha '+label+'.');
  if(fields.second&&!fields.signer2)throw new Error('Preencha o nome da segunda pessoa.');if(fields.includeDate&&!/^\d{4}-\d{2}-\d{2}$/.test(fields.date))throw new Error('Escolha uma data válida.');return fields;
}
function letterCompose(fields){
  const model=LETTER_MODELS[fields.model];let intro='A Nota Fiscal nº '+fields.nf+', emitida pela empresa '+fields.supplier;
  if(fields.cents!==null)intro+=', no valor de '+letterFormatMoney(fields.cents)+(fields.extenso?' ('+letterMoneyWords(fields.cents)+')':'');
  if(fields.object)intro+=model.kind==='servico'?', refere-se ao seguinte serviço: '+fields.object:model.kind==='materiais'?', refere-se à aquisição de materiais para a equipe de manutenção: '+fields.object:', refere-se à seguinte aquisição: '+fields.object;
  else intro+=model.kind==='servico'?', refere-se ao serviço descrito a seguir':', refere-se à aquisição descrita a seguir';
  const paragraphs=[letterParagraph(intro),...fields.reason.split(/\n\s*\n/).map(letterParagraph)];if(fields.context)paragraphs.push(...fields.context.split(/\n\s*\n/).map(letterParagraph));
  if(fields.quotes&&!/(?:três|3)\s+(?:cotações|orçamentos)/i.test(fields.reason+' '+fields.context))paragraphs.push(model.kind==='servico'?'Pelos motivos relatados, não foi possível realizar previamente três orçamentos com fornecedores distintos.':'Pelos motivos relatados, não foi possível realizar previamente três cotações com fornecedores distintos.');
  paragraphs.push(model.kind==='servico'?'Dessa forma, o serviço foi realizado para atender à necessidade relatada e ao adequado funcionamento das instalações do condomínio.':'Dessa forma, a aquisição foi realizada para atender à necessidade relatada, visando preservar a segurança e o adequado funcionamento das instalações do condomínio.');return paragraphs.filter(Boolean).join('\n\n');
}
async function letterFonts(){if(!letterFontPromise)letterFontPromise=Promise.all(['Carlito-Regular.ttf','Carlito-Bold.ttf'].map(async name=>{const r=await fetch('vendor/fonts/'+name);if(!r.ok)throw new Error('Fonte da carta não encontrada: '+name);return new Uint8Array(await r.arrayBuffer());})).catch(e=>{letterFontPromise=null;throw e;});return letterFontPromise;}
function letterWrapWords(text,font,size,width,boldFont=null,boldWords=new Set()){
  const lines=[];let line=[],used=0;const space=font.widthOfTextAtSize(' ',size);
  const pushWord=(word,f)=>{const ww=f.widthOfTextAtSize(word,size);if(line.length&&used+space+ww>width){lines.push(line);line=[];used=0;}line.push({text:word,font:f,width:ww,space:line.length?space:0});used+=ww+(line.length>1?space:0);};
  for(const word of text.split(/\s+/).filter(Boolean)){
    const f=boldFont&&boldWords.has(word.replace(/[(),.;:]$/,''))?boldFont:font;
    if(f.widthOfTextAtSize(word,size)<=width)pushWord(word,f);
    else{let part='';for(const char of word){if(part&&f.widthOfTextAtSize(part+char,size)>width){pushWord(part,f);lines.push(line);line=[];used=0;part=char;}else part+=char;}if(part)pushWord(part,f);}
  }if(line.length)lines.push(line);return lines;
}
async function letterMakePdf(fields,body){
  const out=await PDFDocument.create();out.registerFontkit(fontkit);const fontBytes=await letterFonts();const regular=await out.embedFont(fontBytes[0],{subset:false,features:{liga:false,clig:false,rlig:false,calt:false}}),bold=await out.embedFont(fontBytes[1],{subset:false,features:{liga:false,clig:false,rlig:false,calt:false}});
  const supported=new Set(regular.getCharacterSet());let missing=false;
  const printable=text=>Array.from(String(text)).map(ch=>{if(ch==='\n'||ch==='\t')return ch;if(ch.codePointAt(0)<32)return '';if(supported.has(ch.codePointAt(0)))return ch;missing=true;return '?';}).join('');
  body=printable(body);fields={...fields};for(const key of ['entity','cnpj','city','signer','role','signer2','role2','supplier','nf'])fields[key]=printable(fields[key]);
  const W=595.28,H=841.89,M=84,width=W-2*M,size=11.5,lineHeight=15.7;let pg,cursor;
  const newPage=()=>{pg=out.addPage([W,H]);const title='Carta Explicação'+(out.getPageCount()>1?' — continuação':'');const titleSize=18;pg.drawText(title,{x:(W-bold.widthOfTextAtSize(title,titleSize))/2,y:H-87,size:titleSize,font:bold});cursor=137;};newPage();
  const emphasized=new Set((fields.nf+' '+fields.supplier+' '+(fields.cents===null?'':letterFormatMoney(fields.cents)+' '+letterMoneyWords(fields.cents))).split(/\s+/).map(w=>w.replace(/[(),.;:]$/,'')));
  for(const paragraph of body.split(/\n\s*\n/).filter(p=>p.trim())){
    const lines=letterWrapWords(paragraph,regular,size,width,bold,emphasized);
    for(const line of lines){if(cursor>H-78)newPage();let x=M;for(const item of line){x+=item.space;pg.drawText(item.text,{x,y:H-cursor,size,font:item.font});x+=item.width;}cursor+=lineHeight;}cursor+=9;
  }
  const signers=[{name:fields.signer,role:fields.role}];if(fields.second)signers.push({name:fields.signer2,role:fields.role2});const gap=26,colWidth=signers.length===1?390:(width-gap)/2;
  const blocks=signers.map(s=>({name:letterWrapWords(s.name,bold,11,colWidth),role:letterWrapWords(s.role,bold,11,colWidth)}));
  const nameHeight=Math.max(...blocks.map(b=>(b.name.length+b.role.length)*14));const entityLines=letterWrapWords(fields.entity,bold,11,width);const cnpjLines=fields.cnpj?letterWrapWords('CNPJ: '+fields.cnpj,bold,11,width):[];
  const footerHeight=65+18+nameHeight+10+(entityLines.length+cnpjLines.length)*14+(fields.includeDate?32:0);
  if(cursor+footerHeight>H-55)newPage();const lineTop=cursor+60;
  const centered=(line,cx,top,fontSize=11)=>{const text=line.map(p=>p.text).join(' ');pg.drawText(text,{x:cx-bold.widthOfTextAtSize(text,fontSize)/2,y:H-top,size:fontSize,font:bold});};
  blocks.forEach((block,index)=>{const x=signers.length===1?(W-colWidth)/2:M+index*(colWidth+gap),cx=x+colWidth/2;pg.drawLine({start:{x,y:H-lineTop},end:{x:x+colWidth,y:H-lineTop},thickness:.8,color:PDFLib.rgb(.08,.08,.08)});let y=lineTop+18;block.name.forEach(line=>{centered(line,cx,y);y+=14;});block.role.forEach(line=>{centered(line,cx,y);y+=14;});});
  let identityTop=lineTop+18+nameHeight+9;entityLines.forEach(line=>{centered(line,W/2,identityTop);identityTop+=14;});cnpjLines.forEach(line=>{centered(line,W/2,identityTop);identityTop+=14;});
  if(fields.includeDate){const[y,m,d]=fields.date.split('-').map(Number),months=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];const dateText=(fields.city?fields.city+', ':'')+d+' de '+months[m-1]+' de '+y+'.';pg.drawText(dateText,{x:(W-regular.widthOfTextAtSize(dateText,10.5))/2,y:H-identityTop-19,size:10.5,font:regular});}
  if(out.getPageCount()>1)out.getPages().forEach((page,index)=>{const footer=(index+1)+' / '+out.getPageCount();page.drawText(footer,{x:(W-regular.widthOfTextAtSize(footer,9))/2,y:28,size:9,font:regular,color:PDFLib.rgb(.5,.5,.5)});});
  out.setTitle('Carta de Explicação — NF '+fields.nf);out.setAuthor(fields.entity);out.setSubject('Justificativa referente à nota fiscal '+fields.nf);const bytes=await out.save({useObjectStreams:false});return{bytes,numPages:out.getPageCount(),missing};
}
async function letterRenderPreview(bytes){const doc=await loadPdfJs(bytes);try{const content=document.createDocumentFragment();for(let i=1;i<=doc.numPages;i++){const cv=await renderPage(doc,i,950),wrap=document.createElement('div'),label=document.createElement('span');wrap.className='letter-pdf-page';label.textContent='Página '+i+' de '+doc.numPages;wrap.append(cv,label);content.append(wrap);}$('#letter-preview-pages').replaceChildren(content);}finally{await doc.destroy();}}
async function letterGenerate(edited=false){
  if(letterGenerating)return false;let fields,body;
  try{fields=edited?letterDraft.fields:letterReadFields();body=edited?$('#letter-body').value.trim():letterCompose(fields);if(!body)throw new Error('O texto da carta não pode ficar vazio.');}catch(e){toast(e.message,true);return false;}
  letterGenerating=true;letterSetActions();overlay(true,'Gerando sua carta…','Usando o modelo e as informações que você descreveu, sem reutilizar assinaturas.');
  try{const result=await letterMakePdf(fields,body);await letterRenderPreview(result.bytes);letterPdfBytes=result.bytes;letterDraft={fields:{...fields},body,name:'Carta_de_Explicacao_NF_'+safeSignatureFilename(fields.nf)+'.pdf'};$('#letter-body').value=body;letterFieldsDirty=false;letterEditorDirty=false;$('#letter-result').hidden=false;$('#letter-empty').hidden=true;letterSaveFixed();letterSetStatus('Carta gerada · '+result.numPages+' página(s) · sem assinatura. Revise e baixe ou envie para Assinar.'+(result.missing?' Alguns caracteres não suportados foram substituídos por “?”; confira a prévia.':''),'success');return true;}
  catch(e){console.error(e);letterSetStatus('Não consegui gerar: '+e.message,'stale');toast('Erro ao gerar a carta: '+e.message,true);return false;}
  finally{letterGenerating=false;overlay(false);letterSetActions();}
}
function letterApplyEditedBody(){if(letterDraft&&!letterFieldsDirty)letterGenerate(true);}
function letterDownload(){if(letterPdfBytes&&!letterFieldsDirty&&!letterEditorDirty)download(letterPdfBytes,letterDraft.name);}
async function letterSendToSign(){if(!letterPdfBytes||letterFieldsDirty||letterEditorDirty)return;const ok=await signLoadFiles([new File([letterPdfBytes],letterDraft.name,{type:'application/pdf'})]);if(ok){go('sign');toast('Carta adicionada ao lote de assinatura. Selecione as pessoas e posicione as assinaturas.');}}
function letterInit(){
  const defaults={entity:'Condomínio Comercial E-Business Águas Claras',cnpj:'20.531.870/0001-02',city:'Brasília/DF',signer:'Evandro Moreira da Silva',role:'Síndico',signer2:'Vanderson',role2:'Responsável',second:false};let prefs=defaults;
  try{const stored=JSON.parse(localStorage.getItem(LETTER_PREF_KEY)||'null');if(stored&&typeof stored==='object')prefs={...defaults,...stored};}catch(_){$('#letter-prefs-note').textContent='Dados fixos disponíveis nesta sessão. Se o navegador bloquear armazenamento, será necessário preenchê-los novamente.';}
  LETTER_FIXED_IDS.forEach(id=>$('#letter-'+id).value=String(prefs[id]||'').slice(0,220));$('#letter-second').checked=!!prefs.second;$('#letter-second-fields').hidden=!prefs.second;$('#letter-signer2').required=!!prefs.second;
  $('#letter-date').value=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());letterChooseModel();
  $('#letter-form').addEventListener('submit',e=>{e.preventDefault();letterGenerate();});
  $('#letter-form').addEventListener('input',e=>{letterMarkChanged();if(LETTER_FIXED_IDS.some(id=>e.target.id==='letter-'+id))letterSaveFixed();});
  $('#letter-form').addEventListener('change',e=>{if(e.target.id==='letter-date-enabled')$('#letter-date-field').hidden=!e.target.checked;letterMarkChanged();});
  $('#letter-body').addEventListener('input',()=>{letterEditorDirty=true;letterSetStatus('Texto editado. Clique em “Atualizar prévia com este texto” antes de baixar.','stale');letterSetActions();});letterSetActions();
}
letterInit();
