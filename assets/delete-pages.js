/* Excluir páginas: processamento local, seleção reversível e original preservado. */
'use strict';
let deleteFile=null,deletePages=[],deleteSelection=new Set(),deleteBusy=false,deleteGeneration=0;
setupDrop($('#delete-drop'),files=>deleteLoad(files[0]),false);
async function deleteLoad(file){
  if(!file || deleteBusy)return false;
  if(deleteSelection.size && !confirm('Trocar o PDF descarta esta seleção de páginas. O arquivo original não foi alterado. Continuar?'))return false;
  deleteBusy=true;const generation=++deleteGeneration;let doc;overlay(true,'Abrindo PDF…','Marque as páginas que deseja excluir; o original será mantido.');
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());doc=await loadPdfJs(bytes);const pages=[];
    for(let p=1;p<=doc.numPages;p++){
      if(generation!==deleteGeneration)return false;
      const cv=await renderPage(doc,p,260);pages.push({number:p,thumb:cv.toDataURL('image/jpeg',.82)});prog(p/doc.numPages);
    }
    deleteFile={name:file.name,bytes,numPages:doc.numPages};deletePages=pages;deleteSelection=new Set();$('#delete-range').value='';
    $('#delete-file-name').textContent=file.name;$('#delete-file-meta').textContent=doc.numPages+' página(s) · '+fmtSize(bytes.length);
    $('#delete-drop').style.display='none';$('#delete-ws').classList.add('on');renderDeletePages();return true;
  }catch(e){toast('Não consegui abrir este PDF. Verifique senha ou corrupção.',true);return false;}
  finally{if(doc)await doc.destroy();deleteBusy=false;overlay(false);updateDeleteStatus();}
}
function deleteReset(){
  if(deleteBusy)return;
  if(deleteSelection.size && !confirm('Descartar a seleção e abrir outro PDF?'))return;
  ++deleteGeneration;deleteFile=null;deletePages=[];deleteSelection=new Set();$('#delete-grid').replaceChildren();$('#delete-drop').style.display='';$('#delete-ws').classList.remove('on');$('#delete-range').value='';updateDeleteStatus();
}
function renderDeletePages(){
  const grid=$('#delete-grid');grid.replaceChildren();
  deletePages.forEach(page=>{
    const label=document.createElement('label');label.className='delete-page'+(deleteSelection.has(page.number)?' marked':'');label.dataset.page=page.number;
    const check=document.createElement('input');check.type='checkbox';check.checked=deleteSelection.has(page.number);check.setAttribute('aria-label','Excluir página '+page.number);
    const img=document.createElement('img');img.src=page.thumb;img.alt='Prévia da página '+page.number;img.draggable=false;
    const title=document.createElement('strong');title.textContent='Página '+page.number;
    const hint=document.createElement('span');hint.textContent=check.checked?'Será excluída · clique para desfazer':'Será mantida';
    check.onchange=()=>{
      if(check.checked)deleteSelection.add(page.number);else deleteSelection.delete(page.number);
      label.classList.toggle('marked',check.checked);hint.textContent=check.checked?'Será excluída · clique para desfazer':'Será mantida';updateDeleteStatus();
    };
    label.append(check,img,title,hint);grid.append(label);
  });updateDeleteStatus();
}
function updateDeleteStatus(){
  const count=deleteSelection.size,total=deleteFile?.numPages||0,status=$('#delete-status');status.className='';
  $('#delete-go').disabled=deleteBusy || !deleteFile || !count || count>=total;
  if(!count){status.textContent=total?'Nenhuma página marcada para excluir. As '+total+' páginas serão mantidas.':'Nenhuma página selecionada.';return;}
  if(count>=total){status.textContent='Você marcou todas as páginas. Desmarque pelo menos uma: um PDF precisa ter uma página.';status.className='error';return;}
  status.textContent=count+' página(s) serão excluídas · '+(total-count)+' página(s) permanecerão no arquivo.';
}
function parseDeleteRanges(text,total){
  if(!text.trim())throw new Error('Informe um número ou intervalo, por exemplo: 2, 4-6.');
  const selected=new Set();
  for(const part of text.split(/[,;\n]/)){
    const token=part.trim();if(!token)continue;
    const match=token.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if(!match)throw new Error('Trecho inválido: “'+token+'”. Use números separados por vírgula e intervalos como 4-6.');
    const start=Number(match[1]),end=Number(match[2]||match[1]);
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end>total||start>total)throw new Error('As páginas deste PDF vão de 1 a '+total+'.');
    if(end<start)throw new Error('O intervalo deve estar em ordem crescente, por exemplo 4-6.');
    for(let p=start;p<=end;p++)selected.add(p);
  }
  if(!selected.size)throw new Error('Informe pelo menos uma página.');return selected;
}
function deleteApplyRange(){
  if(!deleteFile)return;
  try{const next=parseDeleteRanges($('#delete-range').value,deleteFile.numPages);deleteSelection=next;renderDeletePages();}
  catch(e){const status=$('#delete-status');status.className='error';status.textContent=e.message;toast(e.message,true);}
}
function deleteSelectAll(){if(!deleteFile)return;deleteSelection=new Set(deletePages.map(p=>p.number));renderDeletePages();}
function deleteClearSelection(){deleteSelection.clear();$('#delete-range').value='';renderDeletePages();}
async function doDeletePages(){
  if(deleteBusy || !deleteFile || !deleteSelection.size || deleteSelection.size>=deleteFile.numPages)return;
  const selected=[...deleteSelection].sort((a,b)=>b-a),source=deleteFile;deleteBusy=true;updateDeleteStatus();overlay(true,'Excluindo páginas…','O download será um novo PDF. Seu arquivo original não será modificado.');
  try{
    // Edita o documento original em memória: texto, rotação, imagens e camadas
    // das páginas mantidas não são recriados nem rasterizados.
    const out=await PDFDocument.load(source.bytes,{ignoreEncryption:true,updateMetadata:false});
    selected.forEach((page,index)=>{out.removePage(page-1);prog((index+1)/selected.length);});
    const bytes=await out.save({useObjectStreams:false});download(bytes,source.name.replace(/\.pdf$/i,'')+'_sem_paginas.pdf');toast('✅ '+selected.length+' página(s) excluída(s). O original foi preservado.');
  }catch(e){console.error(e);toast('Não consegui excluir as páginas: '+e.message,true);}
  finally{deleteBusy=false;overlay(false);updateDeleteStatus();}
}
