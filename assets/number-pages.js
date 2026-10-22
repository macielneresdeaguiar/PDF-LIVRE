/* Numeração visível e sequencial: todas as páginas, a partir de 1.
   Processamento local, sem rasterizar nem substituir o conteúdo original. */
'use strict';
let numberFile=null,numberDims=[],numberBytes=null,numberPreviewDoc=null,numberCurrentPage=1;
let numberBusy=false,numberGeneration=0,numberPreviewGeneration=0,numberRenderTask=null;
const NUMBER_POSITIONS=new Set(['bottom-center','bottom-right','bottom-left','top-center','top-right','top-left']);
setupDrop($('#number-drop'),files=>numberLoad(files[0]),false);

function numberReadOptions(){
  const position=$('#number-position').value,format=$('#number-format').value,size=Number($('#number-size').value),margin=Number($('#number-margin').value),color=$('#number-color').value;
  if(!NUMBER_POSITIONS.has(position)||!['simple','total','page'].includes(format)||![10,12,14,16].includes(size)||![16,24,36,48].includes(margin)||!['black','gray','white'].includes(color))throw new Error('Confira as opções da numeração.');
  return{position,format,size,margin,color,background:$('#number-background').checked};
}
function numberLabel(page,total,format){return format==='total'?page+' / '+total:format==='page'?'Página '+page+' de '+total:String(page);}
function numberPdfPoint(x,y,transform){
  const[a,b,c,d,e,f]=transform,det=a*d-b*c;
  if(!det)throw new Error('Não foi possível determinar as coordenadas desta página.');
  return[(d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det];
}
function numberStampGeometry(dim,font,label,options){
  // As posições usam a página como o leitor a mostra, incluindo /Rotate e
  // CropBox. O inverso do viewport leva o carimbo ao espaço original do PDF.
  const margin=Math.min(options.margin,dim.w/4,dim.h/4),baseWidth=font.widthOfTextAtSize(label,options.size);
  const size=Math.min(options.size,options.size*(dim.w-2*margin)/Math.max(baseWidth,1),options.size*(dim.h-2*margin)/Math.max(font.heightAtSize(options.size),1));
  const width=font.widthOfTextAtSize(label,size),ascent=font.heightAtSize(size,{descender:false}),descent=font.heightAtSize(size)-ascent;
  const[vertical,horizontal]=options.position.split('-');
  const x=horizontal==='left'?margin:horizontal==='right'?dim.w-margin-width:(dim.w-width)/2;
  const y=vertical==='top'?margin+ascent:dim.h-margin-descent;
  const point=numberPdfPoint(x,y,dim.transform),right=numberPdfPoint(x+1,y,dim.transform);
  const scale=Math.hypot(right[0]-point[0],right[1]-point[1]),angle=Math.atan2(right[1]-point[1],right[0]-point[0])*180/Math.PI;
  return{x,y,width,ascent,descent,size,pdfX:point[0],pdfY:point[1],pdfSize:size*scale,scale,angle,padding:Math.min(3,margin/2)};
}
async function numberBuildPdf(file,dims,options){
  const out=await PDFDocument.load(file.bytes,{ignoreEncryption:true,updateMetadata:false}),font=await out.embedFont(PDFLib.StandardFonts.Helvetica);
  const color=options.color==='white'?PDFLib.rgb(1,1,1):options.color==='gray'?PDFLib.rgb(.42,.42,.42):PDFLib.rgb(.08,.08,.08);
  const pages=out.getPages();
  if(pages.length!==dims.length)throw new Error('A quantidade de páginas mudou durante a leitura. Reabra o arquivo.');
  for(let index=0;index<pages.length;index++){
    const dim=dims[index],label=numberLabel(index+1,pages.length,options.format),g=numberStampGeometry(dim,font,label,options);
    if(options.background){
      const p=numberPdfPoint(g.x-g.padding,g.y+g.descent+g.padding,dim.transform);
      // Com tinta branca, o contraste é escuro para manter a numeração visível.
      pages[index].drawRectangle({x:p[0],y:p[1],width:(g.width+g.padding*2)*g.scale,height:(g.ascent+g.descent+g.padding*2)*g.scale,rotate:degrees(g.angle),color:options.color==='white'?PDFLib.rgb(.12,.12,.12):PDFLib.rgb(1,1,1)});
    }
    pages[index].drawText(label,{x:g.pdfX,y:g.pdfY,size:g.pdfSize,font,color,rotate:degrees(g.angle)});
    if(index%30===0){prog(index/pages.length);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  prog(1);return out.save({useObjectStreams:false});
}
function numberUpdateControls(){
  $('#number-download').disabled=numberBusy||!numberBytes;
  $('#number-prev').disabled=numberBusy||!numberPreviewDoc||numberCurrentPage<=1;
  $('#number-next').disabled=numberBusy||!numberPreviewDoc||numberCurrentPage>=numberDims.length;
  $('#number-page-select').disabled=numberBusy||!numberPreviewDoc;
  $('#number-reset').disabled=numberBusy;
  document.querySelectorAll('#number-settings select,#number-settings input').forEach(el=>el.disabled=numberBusy||!numberFile);
  $('#number-preview-label').textContent=numberFile?'Página '+numberCurrentPage+' de '+numberDims.length:'';
  $('#number-page-select').value=String(numberCurrentPage);
}
async function numberCancelRender(){
  numberPreviewGeneration++;
  if(numberRenderTask){const task=numberRenderTask;task.cancel();try{await task.promise;}catch(_){}if(numberRenderTask===task)numberRenderTask=null;}
}
async function numberRenderPreview(){
  if(!numberPreviewDoc)return;
  await numberCancelRender();
  const generation=++numberPreviewGeneration,doc=numberPreviewDoc,pageNumber=numberCurrentPage;
  const page=await doc.getPage(pageNumber);
  if(generation!==numberPreviewGeneration||doc!==numberPreviewDoc)return;
  const base=page.getViewport({scale:1}),vp=page.getViewport({scale:Math.min(2,1100/base.width)}),canvas=$('#number-preview');
  canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
  const task=page.render({canvasContext:canvas.getContext('2d'),viewport:vp});numberRenderTask=task;
  try{await task.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;}
  finally{if(numberRenderTask===task)numberRenderTask=null;}
  numberUpdateControls();
}
async function numberLoad(file){
  if(!file)return false;
  if(numberBusy){toast('Aguarde a numeração atual terminar.',true);return false;}
  const generation=++numberGeneration;let original,preview;
  numberBusy=true;numberUpdateControls();overlay(true,'Preparando a numeração…','Todas as páginas serão numeradas em sequência, a partir de 1.');
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());original=await loadPdfJs(bytes);const dims=[];
    for(let p=1;p<=original.numPages;p++){
      const page=await original.getPage(p),vp=page.getViewport({scale:1});dims.push({w:vp.width,h:vp.height,transform:vp.transform.slice()});prog(p/original.numPages*.2);
    }
    const source={name:file.name,bytes,numPages:original.numPages},options=numberReadOptions(),output=await numberBuildPdf(source,dims,options);
    preview=await loadPdfJs(output);if(generation!==numberGeneration){await preview.destroy();return false;}
    await numberCancelRender();if(numberPreviewDoc)await numberPreviewDoc.destroy();
    numberFile=source;numberDims=dims;numberBytes=output;numberPreviewDoc=preview;preview=null;numberCurrentPage=1;
    $('#number-file-name').textContent=file.name;$('#number-file-meta').textContent=source.numPages+' página(s) · '+fmtSize(bytes.length)+' · sequência de 1 a '+source.numPages;
    const select=$('#number-page-select');select.replaceChildren();for(let p=1;p<=source.numPages;p++){const option=document.createElement('option');option.value=p;option.textContent='Página '+p;select.append(option);}
    $('#number-drop').style.display='none';$('#number-ws').classList.add('on');await numberRenderPreview();
    $('#number-status').textContent='Prévia pronta: '+source.numPages+' página(s), numeradas de 1 a '+source.numPages+'. O download terá essa mesma numeração.';
    return true;
  }catch(e){console.warn('Numerar PDF:',e);toast('Não foi possível numerar este PDF. Verifique se está protegido por senha ou corrompido.',true);return false;}
  finally{if(original)await original.destroy();if(preview)await preview.destroy();numberBusy=false;overlay(false);numberUpdateControls();}
}
async function numberRefresh(){
  if(numberBusy||!numberFile)return;
  const generation=++numberGeneration;let preview;
  numberBusy=true;numberUpdateControls();overlay(true,'Atualizando a numeração…','O texto e as imagens do documento original serão mantidos.');
  try{
    const output=await numberBuildPdf(numberFile,numberDims,numberReadOptions());preview=await loadPdfJs(output);
    if(generation!==numberGeneration){await preview.destroy();return;}
    await numberCancelRender();if(numberPreviewDoc)await numberPreviewDoc.destroy();numberPreviewDoc=preview;preview=null;numberBytes=output;await numberRenderPreview();
    $('#number-status').textContent='Prévia atualizada. A sequência continua de 1 a '+numberDims.length+'.';
  }catch(e){numberBytes=null;$('#number-status').textContent='Não foi possível atualizar. Revise as opções ou reabra o PDF.';toast('Erro na numeração: '+e.message,true);}
  finally{if(preview)await preview.destroy();numberBusy=false;overlay(false);numberUpdateControls();}
}
async function numberGoPage(value){
  if(numberBusy||!numberPreviewDoc)return;
  const n=Number(value);if(!Number.isInteger(n)||n<1||n>numberDims.length)return;
  numberCurrentPage=n;numberUpdateControls();try{await numberRenderPreview();}catch(e){toast('Não foi possível mostrar esta página.',true);}
}
function numberDownload(){
  if(numberBusy||!numberFile||!numberBytes)return;
  download(numberBytes,numberFile.name.replace(/\.pdf$/i,'')+'_numerado.pdf');toast('✅ PDF baixado com páginas numeradas de 1 a '+numberDims.length+'.');
}
async function numberReset(){
  if(numberBusy)return;
  numberBusy=true;numberUpdateControls();++numberGeneration;
  try{await numberCancelRender();if(numberPreviewDoc)await numberPreviewDoc.destroy();}
  finally{
    numberFile=null;numberPreviewDoc=null;numberDims=[];numberBytes=null;numberCurrentPage=1;
    $('#number-preview').width=1;$('#number-preview').height=1;$('#number-page-select').replaceChildren();$('#number-status').textContent='';$('#number-ws').classList.remove('on');$('#number-drop').style.display='';numberBusy=false;numberUpdateControls();
  }
}
numberUpdateControls();
