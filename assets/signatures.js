/* PDF Livre — assinaturas visuais. Nenhuma requisição envia PDFs ou assinaturas.
   As marcas posicionadas guardam sua própria imagem: escolher outra pessoa nunca
   troca as assinaturas já colocadas no documento. Biblioteca: até 10, no dispositivo. */
'use strict';

const SIGNATURE_MAX = 10;
const SIG_STORE_KEY = 'pdf-livre.assinaturas.v1';
const SIGFONTS = [
  {family:'SigAllura', label:'Fluida · Allura'},
  {family:'SigGreatVibes', label:'Clássica · Great Vibes'},
  {family:'SigSacramento', label:'Leve · Sacramento'},
  {family:'SigCaveat', label:'Natural · Caveat'}
];
let sigLibrary = [], sigSelected = new Set();
let sigStorage = {mode:'memory', db:null};
let sigLibraryLoaded = false, sigLibraryChannel = null;
let signFile = null, signSources = [], signPageDims = [], signPlacements = [];
let placing = false, placingSignatures = [], placingRepeat = false, placingLastPages = false;
let sigSeq = 0, selPlacement = null, signLoading = false, signLoadGeneration = 0;
let penColor = '#111111', sigTabCur = 'type', selFont = 0;
let sigSaving = false, sigModalFocus = null, sigManageContext = null;
let sigDrawStrokes = [], sigDrawingStroke = null;
let sigPhotoCanvas = null, sigPhotoCrop = null, sigProcessedCanvas = null;
let sigPhotoTimer = null, sigPhotoBusy = false, sigPhotoVersion = 0, sigPhotoLoadVersion = 0;
const sigDrawCanvas = $('#sig-draw');
const sigDrawContext = sigDrawCanvas.getContext('2d');
const sigClamp = (v, min, max) => Math.min(max, Math.max(min, v));
const sigNewId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'sig-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));

/* ================= Armazenamento local ================= */
function openSignatureDatabase(){
  return new Promise((resolve,reject)=>{
    let request, done = false;
    const finish = (error,db)=>{
      if(done){ if(db) db.close(); return; }
      done = true; clearTimeout(timer);
      if(error) reject(error); else resolve(db);
    };
    const timer = setTimeout(()=>finish(new Error('Armazenamento não respondeu.')),3500);
    try{ request = indexedDB.open('pdf-livre-assinaturas',1); }
    catch(e){ finish(e); return; }
    request.onupgradeneeded = ()=>{
      const db = request.result;
      if(!db.objectStoreNames.contains('signatures')) db.createObjectStore('signatures',{keyPath:'id'});
    };
    request.onsuccess = ()=>{
      const db = request.result;
      db.onversionchange = ()=>db.close();
      finish(null,db);
    };
    request.onerror = ()=>finish(request.error || new Error('Não foi possível abrir a biblioteca.'));
    request.onblocked = ()=>finish(new Error('Feche outras abas para abrir a biblioteca.'));
  });
}
function readSignatureDatabase(){
  return new Promise((resolve,reject)=>{
    try{
      const tx = sigStorage.db.transaction('signatures','readonly');
      const req = tx.objectStore('signatures').getAll();
      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error);
    }catch(e){ reject(e); }
  });
}
function validStoredSignature(s){
  return s && typeof s.id === 'string' && typeof s.name === 'string' && s.name.length > 0 && s.name.length <= 80 &&
    typeof s.dataURL === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.dataURL) && s.dataURL.length < 4000000 &&
    Number.isFinite(s.w) && Number.isFinite(s.h) && s.w >= 1 && s.h >= 1 && s.w <= 1600 && s.h <= 1600;
}
function setSignatureLibrary(records){
  sigLibrary = records.filter(validStoredSignature).slice(0,SIGNATURE_MAX).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const validIds = new Set(sigLibrary.map(s=>s.id));
  sigSelected = new Set([...sigSelected].filter(id=>validIds.has(id)));
  renderSignatureLibrary();
  updateSignBar();
}
async function initSignatureLibrary(){
  let records = [];
  try{
    sigStorage.db = await openSignatureDatabase();
    sigStorage.mode = 'indexeddb';
    records = await readSignatureDatabase();
  }catch(e){
    if(sigStorage.db){ sigStorage.db.close(); sigStorage.db = null; }
    try{
      const test = SIG_STORE_KEY+'.test'; localStorage.setItem(test,'1'); localStorage.removeItem(test);
      sigStorage.mode = 'localstorage';
      const saved = localStorage.getItem(SIG_STORE_KEY);
      records = saved ? JSON.parse(saved) : [];
      if(!Array.isArray(records)) throw new Error('Backup local inválido.');
    }catch(_){ sigStorage.mode = 'memory'; records = []; }
  }
  sigLibraryLoaded = true;
  setSignatureLibrary(records);
  try{
    sigLibraryChannel = new BroadcastChannel('pdf-livre-assinaturas');
    sigLibraryChannel.onmessage = async ()=>{
      try{
        const recs = sigStorage.mode === 'indexeddb' ? await readSignatureDatabase() :
          (sigStorage.mode === 'localstorage' ? JSON.parse(localStorage.getItem(SIG_STORE_KEY)||'[]') : sigLibrary);
        setSignatureLibrary(recs);
      }catch(_){}
    };
  }catch(_){}
}
async function updateSignatureStorage(mutator){
  await signatureLibraryReady;
  let next;
  if(sigStorage.mode === 'indexeddb'){
    next = await new Promise((resolve,reject)=>{
      let result, failure;
      try{
        // A leitura e a gravação ocorrem na mesma transação: o limite também
        // vale quando duas abas tentam cadastrar ao mesmo tempo.
        const tx = sigStorage.db.transaction('signatures','readwrite');
        const store = tx.objectStore('signatures');
        const req = store.getAll();
        req.onsuccess = ()=>{
          try{
            result = mutator(req.result);
            if(result.length > SIGNATURE_MAX) throw new Error('Você já tem 10 assinaturas. Exclua uma antes de adicionar outra.');
            if(!result.every(validStoredSignature)) throw new Error('Dados da assinatura inválidos.');
            store.clear(); result.forEach(s=>store.put(s));
          }catch(e){ failure = e; tx.abort(); }
        };
        tx.oncomplete = ()=>resolve(result);
        tx.onerror = ()=>reject(failure || tx.error || new Error('Não foi possível salvar.'));
        tx.onabort = ()=>reject(failure || tx.error || new Error('Gravação cancelada.'));
      }catch(e){ reject(e); }
    });
  }else{
    const current = sigStorage.mode === 'localstorage' ? JSON.parse(localStorage.getItem(SIG_STORE_KEY)||'[]') : sigLibrary;
    next = mutator(current);
    if(next.length > SIGNATURE_MAX) throw new Error('Você já tem 10 assinaturas. Exclua uma antes de adicionar outra.');
    if(!next.every(validStoredSignature)) throw new Error('Dados da assinatura inválidos.');
    if(sigStorage.mode === 'localstorage'){
      try{ localStorage.setItem(SIG_STORE_KEY,JSON.stringify(next)); }
      catch(e){ throw new Error('Sem espaço para salvar. Exporte um backup e libere espaço no navegador.'); }
    }
  }
  setSignatureLibrary(next);
  if(sigLibraryChannel) sigLibraryChannel.postMessage('changed');
  return next;
}
function signatureSelection(){ return sigLibrary.filter(s=>sigSelected.has(s.id)); }
function toggleSignatureSelection(id){
  cancelPlacing();
  if(sigSelected.has(id)) sigSelected.delete(id); else sigSelected.add(id);
  renderSignatureLibrary(); updateSignBar();
}
function selectAllSignatures(){ cancelPlacing(); sigSelected = new Set(sigLibrary.map(s=>s.id)); renderSignatureLibrary(); updateSignBar(); }
function clearSignatureSelection(){ cancelPlacing(); sigSelected.clear(); renderSignatureLibrary(); updateSignBar(); }
function renderSignatureLibrary(){
  const grid = $('#sig-library-grid'); grid.replaceChildren();
  $('#sig-library-count').textContent = sigLibrary.length+' / '+SIGNATURE_MAX;
  $('#sig-new-btn').disabled = !sigLibraryLoaded || sigLibrary.length >= SIGNATURE_MAX;
  $('#sig-new-btn').title = sigLibrary.length >= SIGNATURE_MAX ? 'Limite de 10. Exclua uma assinatura para cadastrar outra.' : '';
  $('#sig-export-btn').disabled = !sigLibrary.length;
  $('#sig-library-select').hidden = !sigLibrary.length;
  const count = sigSelected.size;
  $('#sig-selected-count').textContent = count ? count+' assinatura'+(count>1?'s selecionadas':' selecionada')+' — podem entrar juntas no PDF' : 'Marque as pessoas que vão assinar este PDF.';
  const note = $('#sig-storage-note');
  note.classList.toggle('warn',sigStorage.mode === 'memory');
  note.textContent = sigStorage.mode === 'memory' ? '⚠ Este navegador bloqueou o armazenamento. As assinaturas ficam apenas nesta sessão; exporte um backup antes de fechar.' :
    '🔒 Salvas neste navegador e neste endereço do site. Limpar os dados ou usar navegação anônima pode apagar a biblioteca. Exporte um backup para guardar ou usar em outro dispositivo.';
  if(!sigLibrary.length){
    const empty = document.createElement('div'); empty.className = 'sign-library-empty';
    const bold = document.createElement('b'); bold.textContent = 'Sua biblioteca começa aqui.';
    empty.append(bold,document.createElement('br'),document.createTextNode('Crie, por exemplo, uma assinatura para Vanderson e outra para Evandro Moreira. Depois selecione as duas para usar no mesmo PDF.'));
    grid.append(empty); return;
  }
  sigLibrary.forEach(s=>{
    const card = document.createElement('article'); card.className = 'sign-entry'+(sigSelected.has(s.id)?' checked':''); card.dataset.signature = s.id;
    const label = document.createElement('label'); label.className = 'signature-check';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = sigSelected.has(s.id); check.setAttribute('aria-label','Selecionar '+s.name);
    check.onchange = ()=>toggleSignatureSelection(s.id);
    const name = document.createElement('span'); name.textContent = s.name; name.title = s.name;
    label.append(check,name);
    const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'signature-card-preview checker'; preview.setAttribute('aria-label','Selecionar assinatura de '+s.name); preview.onclick = ()=>toggleSignatureSelection(s.id);
    const img = document.createElement('img'); img.src = s.dataURL; img.alt = 'Assinatura de '+s.name; img.draggable = false; preview.append(img);
    const footer = document.createElement('div'); footer.className = 'sign-entry-footer';
    const kind = document.createElement('span'); kind.className = 'signature-kind'; kind.textContent = ({type:'Pelo nome',draw:'Desenhada',img:'Foto / imagem'})[s.kind] || 'Importada'; footer.append(kind);
    [
      ['↓','Baixar PNG transparente',()=>downloadSignaturePng(s)],
      ['✎','Renomear '+s.name,()=>openSigManage(s.id,'rename')],
      ['✕','Excluir '+s.name,()=>openSigManage(s.id,'delete')]
    ].forEach(([text,title,fn])=>{
      const b = document.createElement('button'); b.className = 'iconbtn'+(text==='✕'?' danger':''); b.textContent = text; b.title = title; b.setAttribute('aria-label',title); b.onclick = fn; footer.append(b);
    });
    card.append(label,preview,footer); grid.append(card);
  });
}
function downloadSignatureFile(blob,name){
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function safeSignatureFilename(name){ return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,80) || 'assinatura'; }
function signaturePngBytes(dataURL){ return Uint8Array.from(atob(dataURL.split(',')[1]),c=>c.charCodeAt(0)); }
function downloadSignaturePng(s){ downloadSignatureFile(new Blob([signaturePngBytes(s.dataURL)],{type:'image/png'}),safeSignatureFilename(s.name)+'_assinatura.png'); }
async function exportSignatureLibrary(){
  await signatureLibraryReady;
  if(!sigLibrary.length) return;
  const backup = {format:'pdf-livre-signatures',version:1,exportedAt:new Date().toISOString(),signatures:sigLibrary};
  downloadSignatureFile(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),'pdf-livre-assinaturas-backup.json');
  toast('Backup exportado. Guarde este arquivo em um lugar seguro.');
}
function pickSignatureBackup(){ const input = $('#fi-sig-backup'); input.value = ''; input.click(); }
async function decodeSignatureImage(dataURL){
  return new Promise((resolve,reject)=>{
    const img = new Image(); img.onload = ()=>resolve(img); img.onerror = ()=>reject(new Error('Imagem inválida ou formato não suportado. Use JPG, PNG ou WebP.')); img.src = dataURL;
  });
}
async function importSignatureBackup(file){
  try{
    await signatureLibraryReady;
    if(file.size > 32000000) throw new Error('Backup muito grande. Use um backup exportado pelo PDF Livre.');
    const data = JSON.parse(await file.text());
    if(data.format !== 'pdf-livre-signatures' || data.version !== 1 || !Array.isArray(data.signatures) || data.signatures.length > SIGNATURE_MAX)
      throw new Error('Não é um backup válido do PDF Livre (até 10 assinaturas).');
    const imported = [];
    for(const value of data.signatures){
      if(!validStoredSignature(value)) throw new Error('O backup contém uma assinatura inválida. Nenhum dado foi importado.');
      const raw = signaturePngBytes(value.dataURL);
      if(raw[0]!==137 || raw[1]!==80 || raw[2]!==78 || raw[3]!==71 || raw[12]!==73 || raw[13]!==72 || raw[14]!==68 || raw[15]!==82)
        throw new Error('O backup contém uma imagem que não é PNG.');
      const view = new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
      if(view.getUint32(16)>1600 || view.getUint32(20)>1600) throw new Error('Imagem do backup acima do tamanho permitido.');
      const img = await decodeSignatureImage(value.dataURL);
      if(img.naturalWidth !== value.w || img.naturalHeight !== value.h) throw new Error('As dimensões de uma assinatura do backup não conferem.');
      // Reencoda só os pixels. Nada executável ou metadados de terceiros é reaproveitado.
      const clean = document.createElement('canvas'); clean.width = img.naturalWidth; clean.height = img.naturalHeight;
      clean.getContext('2d').drawImage(img,0,0);
      imported.push({id:sigNewId(),name:value.name.trim()||'Assinatura',dataURL:clean.toDataURL('image/png'),w:clean.width,h:clean.height,kind:['type','draw','img'].includes(value.kind)?value.kind:'img',createdAt:Date.now()+imported.length});
    }
    let added = [];
    await updateSignatureStorage(current=>{
      added = imported.filter(s=>!current.some(c=>c.name === s.name && c.dataURL === s.dataURL));
      if(current.length + added.length > SIGNATURE_MAX) throw new Error('O backup ultrapassaria o limite de 10. Exclua algumas assinaturas antes de importar.');
      return current.concat(added);
    });
    added.forEach(s=>sigSelected.add(s.id)); renderSignatureLibrary(); updateSignBar();
    toast(added.length ? '✅ '+added.length+' assinatura(s) importada(s).' : 'Estas assinaturas já estão na biblioteca.');
  }catch(e){ toast('Não foi possível importar: '+e.message,true); }
}
$('#fi-sig-backup').addEventListener('change',e=>{ if(e.target.files[0]) importSignatureBackup(e.target.files[0]); });

function openSigManage(id,mode){
  const sig = sigLibrary.find(s=>s.id === id); if(!sig) return;
  cancelPlacing(); clearTimeout($('#toast')._h); $('#toast').className=''; sigManageContext = {id,mode,focus:document.activeElement};
  $('#sig-manage-title').textContent = mode === 'delete' ? 'Excluir assinatura?' : 'Renomear assinatura';
  $('#sig-manage-image').src = sig.dataURL;
  $('#sig-manage-name-field').hidden = mode === 'delete';
  $('#sig-manage-name').value = sig.name;
  $('#sig-manage-note').textContent = mode === 'delete' ? '“'+sig.name+'” será removida da biblioteca. As cópias já posicionadas no PDF atual não serão apagadas.' : 'O nome identifica a pessoa na biblioteca. O desenho e as cópias já posicionadas não mudam.';
  const confirm = $('#sig-manage-confirm'); confirm.textContent = mode === 'delete' ? 'Excluir assinatura' : 'Salvar nome'; confirm.style.background = mode === 'delete' ? 'var(--red)' : ''; confirm.disabled = false;
  $('#sig-manage-modal').classList.add('on'); document.body.classList.add('sig-modal-open');
  (mode === 'delete' ? confirm : $('#sig-manage-name')).focus();
}
function closeSigManage(){
  $('#sig-manage-modal').classList.remove('on'); if(!$('#sigmodal').classList.contains('on')) document.body.classList.remove('sig-modal-open');
  const focus = sigManageContext?.focus; sigManageContext = null;
  if(focus?.isConnected) focus.focus(); else $('#sig-new-btn').focus();
}
async function confirmSigManage(){
  if(!sigManageContext) return;
  const {id,mode} = sigManageContext;
  const name = $('#sig-manage-name').value.trim();
  if(mode === 'rename' && !name){ toast('Informe o nome da pessoa.',true); return; }
  $('#sig-manage-confirm').disabled = true;
  try{
    await updateSignatureStorage(current=>mode === 'delete' ? current.filter(s=>s.id!==id) : current.map(s=>s.id===id?{...s,name:name.slice(0,80)}:s));
    cancelPlacing(); closeSigManage(); toast(mode === 'delete' ? 'Assinatura excluída da biblioteca.' : 'Nome atualizado.');
  }catch(e){ toast('Erro: '+e.message,true); }
  finally{ $('#sig-manage-confirm').disabled = false; }
}

/* ================= Vários PDFs em um lote, posições independentes ================= */
setupDrop($('#sign-drop'),fs=>signLoadFiles(fs),true);
async function signLoad(file){ return signLoadFiles([file]); } // compatibilidade / carta gerada
async function signPickMore(){ const fs=await pickFiles(true);if(fs.length)await signLoadFiles(fs); }
async function signLoadFiles(files,{replace=false}={}){
  const pdfs=[...files].filter(isPdfFile);if(!pdfs.length)return false;
  await signatureLibraryReady;
  if(signLoading){toast('Aguarde o lote atual terminar de abrir.',true);return false;}
  if(replace && signPlacements.length && !confirm('Abrir um novo lote descarta as posições atuais, mas mantém a biblioteca. Continuar?'))return false;
  const generation=++signLoadGeneration,wasEmpty=!signSources.length;
  signLoading=true;cancelPlacing();updateSignBar();overlay(true,'Abrindo seus PDFs…','Eles serão baixados juntos em um único PDF, na ordem da lista.');
  try{
    const sources=replace?[]:[...signSources];
    let sourceNumber=sources.reduce((n,s)=>Math.max(n,s.fileNumber),0);
    for(let i=0;i<pdfs.length;i++){
      const f=pdfs[i],bytes=new Uint8Array(await f.arrayBuffer());let check;
      try{check=await loadPdfJs(bytes);sources.push({id:sigNewId(),fileNumber:++sourceNumber,name:f.name,bytes,pageCount:check.numPages});}
      catch(e){throw new Error('Não consegui abrir “'+f.name+'”. Verifique senha ou corrupção. Nenhum arquivo deste envio foi adicionado.');}
      finally{if(check)await check.destroy();}
      prog((i+1)/pdfs.length*.15);
    }
    await compileSignSources(sources,{preserve:!replace,generation});
    if(wasEmpty && sources.length>1){$('#sig-repeat-last').checked=true;$('#sig-repeat').checked=false;}
    toast(pdfs.length+' PDF(s) adicionado(s). Selecione as assinaturas e onde elas devem entrar.');return true;
  }catch(e){console.warn('Lote de assinaturas:',e);toast(e.message,true);return false;}
  finally{signLoading=false;overlay(false);updateSignBar();renderSignSourceList();}
}
async function compileSignSources(sources,{preserve=true,generation=signLoadGeneration}={}){
  let bytes;
  if(sources.length===1)bytes=sources[0].bytes;
  else{
    const out=await PDFDocument.create();
    for(let i=0;i<sources.length;i++){
      const src=await PDFDocument.load(sources[i].bytes,{ignoreEncryption:true,updateMetadata:false});
      const copied=await out.copyPages(src,src.getPageIndices());copied.forEach(page=>out.addPage(page));copyOCProperties(out,src);
      prog(.15+(i+1)/sources.length*.15);
    }
    bytes=await out.save({useObjectStreams:false});
  }
  const d=await loadPdfJs(bytes);
  try{
    const cont=document.createDocumentFragment(),dims=[],newSources=[];let offset=0;
    sources.forEach(source=>{newSources.push({...source,start:offset,end:offset+source.pageCount});offset+=source.pageCount;});
    let sourceIndex=0;
    for(let p=1;p<=d.numPages;p++){
      if(generation!==signLoadGeneration)throw new Error('A abertura do lote foi cancelada.');
      while(sourceIndex<newSources.length-1 && p-1>=newSources[sourceIndex].end)sourceIndex++;
      const source=newSources[sourceIndex],originalPage=p-1-source.start;
      const page=await d.getPage(p),vp1=page.getViewport({scale:1});
      dims.push({w:vp1.width,h:vp1.height,transform:vp1.transform.slice(),rotation:vp1.rotation,sourceId:source.id,originalPage,fileName:source.name,fileNumber:source.fileNumber});
      const scale=Math.min(2,1520/vp1.width),vp=page.getViewport({scale});
      const c=document.createElement('canvas');c.className='pgcv';c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
      await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      const wrap=document.createElement('div');wrap.className='spage';wrap.dataset.page=p-1;wrap.dataset.source=source.id;
      const label=document.createElement('div');label.className='plabel';
      label.textContent='Arquivo '+source.fileNumber+' · pág. '+(originalPage+1)+'/'+source.pageCount+' · '+source.name+' · posição '+p+'/'+d.numPages;label.title=label.textContent;
      wrap.append(label,c);wrap.addEventListener('click',e=>pageClick(e,wrap));cont.append(wrap);prog(.30+p/d.numPages*.70);
    }
    const pageByOrigin=new Map(dims.map((dim,index)=>[dim.sourceId+':'+dim.originalPage,index]));
    const placements=preserve?signPlacements.flatMap(pl=>{
      const old=signPageDims[pl.page];if(!old)return[];const index=pageByOrigin.get(old.sourceId+':'+old.originalPage);
      return index===undefined?[]:[{...pl,page:index}];
    }):[];
    signSources=newSources;signFile={name:sources.length===1?sources[0].name:'documentos_unificados.pdf',bytes};signPageDims=dims;signPlacements=placements;
    if(!placements.some(p=>p.id===selPlacement))selPlacement=null;
    $('#sign-pages').replaceChildren(cont);$('#sign-drop').style.display='none';$('#sign-ws').classList.add('on');
    $('#sign-file-name').textContent=sources.length===1?sources[0].name:sources.length+' PDFs no mesmo lote';
    $('#sign-file-meta').textContent=dims.length+' página(s) no total · '+fmtSize(bytes.length)+' · download em um único PDF';
    renderPlacements();renderSignSourceList();
  }finally{await d.destroy();}
}
function renderSignSourceList(){
  const list=$('#sign-source-list');if(!list)return;list.replaceChildren();
  signSources.forEach((source,index)=>{
    const row=document.createElement('div');row.className='sign-source-row';row.dataset.source=source.id;
    const meta=document.createElement('div');meta.className='sign-source-meta';
    const name=document.createElement('strong');name.textContent=source.name;name.title=source.name;
    const hint=document.createElement('span');hint.textContent='Arquivo '+source.fileNumber+' · '+source.pageCount+' página(s) · posições '+(source.start+1)+'–'+source.end;meta.append(name,hint);
    const actions=document.createElement('div');actions.className='sign-source-actions';
    [['↑','Mover arquivo para cima',()=>signMoveSource(index,-1),index===0],['↓','Mover arquivo para baixo',()=>signMoveSource(index,1),index===signSources.length-1],['✕','Remover este arquivo do lote',()=>signRemoveSource(source.id),false]].forEach(([text,title,fn,disabled])=>{
      const b=document.createElement('button');b.className='iconbtn'+(text==='✕'?' danger':'');b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.disabled=signLoading||disabled;b.onclick=fn;actions.append(b);
    });row.append(meta,actions);list.append(row);
  });
}
async function rebuildSignSources(sources){
  if(signLoading)return false;const generation=++signLoadGeneration;signLoading=true;cancelPlacing();updateSignBar();overlay(true,'Atualizando o lote…','As posições acompanham a página original de cada arquivo.');
  try{await compileSignSources(sources,{preserve:true,generation});return true;}
  catch(e){toast('Não foi possível atualizar: '+e.message,true);return false;}
  finally{signLoading=false;overlay(false);updateSignBar();renderSignSourceList();}
}
async function signMoveSource(index,direction){
  const to=index+direction;if(to<0||to>=signSources.length||signLoading)return;
  const next=[...signSources];[next[index],next[to]]=[next[to],next[index]];await rebuildSignSources(next);
}
async function signRemoveSource(id){
  if(signLoading)return;
  const hasMarks=signPlacements.some(p=>signPageDims[p.page]?.sourceId===id);
  if(hasMarks && !confirm('Remover este PDF também remove suas assinaturas posicionadas. Os outros PDFs e a biblioteca serão mantidos. Continuar?'))return;
  const next=signSources.filter(s=>s.id!==id);
  if(!next.length){signClearDocument();return;}await rebuildSignSources(next);
}
function signClearDocument(){
  ++signLoadGeneration;signFile=null;signSources=[];signPlacements=[];signPageDims=[];selPlacement=null;cancelPlacing();
  $('#sign-pages').replaceChildren();$('#sign-source-list').replaceChildren();$('#sign-drop').style.display='';$('#sign-ws').classList.remove('on');$('#sig-repeat').checked=false;$('#sig-repeat-last').checked=false;updateSignBar();
}
function signReset(){
  if(signLoading)return;
  if(signPlacements.length && !confirm('Recomeçar remove os PDFs e suas posições atuais. A biblioteca de assinaturas será mantida. Continuar?'))return;signClearDocument();
}
function setSignRepeatMode(mode){
  if(mode==='all' && $('#sig-repeat').checked)$('#sig-repeat-last').checked=false;
  if(mode==='last' && $('#sig-repeat-last').checked)$('#sig-repeat').checked=false;cancelPlacing();
}

function clearSignPlacements(){
  if(!signPlacements.length || !confirm('Remover todas as assinaturas posicionadas neste PDF? A biblioteca não será alterada.')) return;
  signPlacements = []; selPlacement = null; cancelPlacing(); renderPlacements();
}
function updateSignBar(){
  const selected = signatureSelection();
  $('#sig-place-btn').disabled = signLoading || !signFile || !selected.length;
  $('#sig-place-btn').textContent = selected.length > 1 ? '📍 Posicionar '+selected.length+' selecionadas' : '📍 Posicionar selecionada';
  $('#sign-go').disabled = signLoading || !signFile || !signPlacements.length;
  $('#sign-go').textContent = signSources.length>1 ? 'Baixar PDFs juntos ↓' : 'Baixar PDF assinado ↓';
  $('#sig-clear-btn').disabled = !signPlacements.length;
  const covered=new Set(signPlacements.map(p=>signPageDims[p.page]?.sourceId)).size;
  const people = new Set(signPlacements.map(p=>p.signature.name.trim().toLocaleLowerCase('pt-BR'))).size;
  $('#sign-count').textContent = signPlacements.length ? signPlacements.length+' assinatura'+(signPlacements.length>1?'s':'')+' no lote · '+people+' pessoa'+(people>1?'s':'')+' · '+covered+'/'+signSources.length+' arquivo(s) com assinatura · arraste para mover, use o círculo roxo para redimensionar.' :
    'Marque as assinaturas na biblioteca. Elas podem ser colocadas juntas, lado a lado.';
}
function startPlacing(){
  if(!signFile) return;
  const selected = signatureSelection();
  if(!selected.length){ toast('Selecione uma ou mais pessoas na biblioteca.',true); return; }
  placing = true; placingSignatures = selected.map(s=>({...s})); placingRepeat = $('#sig-repeat').checked; placingLastPages = $('#sig-repeat-last').checked; selPlacement = null;
  const names = selected.map(s=>s.name).join(' + ');
  $('#placing-message').textContent = 'Clique no PDF para colocar '+names+(placingRepeat?' em todas as páginas.':placingLastPages?' na última página de cada PDF.':' neste local.')+(selected.length>1?' Depois ajuste cada assinatura separadamente.':'');
  $('#placing-banner').classList.add('on'); document.querySelectorAll('.spage').forEach(s=>s.classList.add('placing'));
  document.querySelectorAll('.sigbox.sel').forEach(s=>s.classList.remove('sel'));
  const first = $('#sign-pages .spage');
  if(first){ const r = first.getBoundingClientRect(); if(r.top > window.innerHeight-140 || r.bottom < 120) first.scrollIntoView({behavior:'smooth',block:'start'}); }
}
function cancelPlacing(){
  placing = false; placingSignatures = [];
  $('#placing-banner').classList.remove('on'); document.querySelectorAll('.spage').forEach(s=>s.classList.remove('placing'));
}
function signatureHeightFraction(pl){ const dims = signPageDims[pl.page]; return pl.wr*(pl.signature.h/pl.signature.w)*(dims.w/dims.h); }
function signatureGroupPositions(signatures,page,cx,cy){
  const dims = signPageDims[page], columns = Math.min(3,signatures.length), gapX = .025, gapY = .022;
  const cellW = signatures.length===1 ? .28 : .255;
  const cells = signatures.map(s=>{
    const aspect = (s.h/s.w)*(dims.w/dims.h), wr = Math.min(cellW,.15/Math.max(aspect,.001));
    return {s,wr,hr:wr*aspect};
  });
  const rowCount = Math.ceil(cells.length/columns), heights = [];
  for(let row=0;row<rowCount;row++) heights.push(Math.max(...cells.slice(row*columns,(row+1)*columns).map(c=>c.hr)));
  const groupW = columns*cellW+(columns-1)*gapX, groupH = heights.reduce((a,b)=>a+b,0)+(rowCount-1)*gapY;
  const x0 = sigClamp(cx-groupW/2,.01,1-groupW-.01), y0 = sigClamp(cy-groupH/2,.01,1-groupH-.01);
  return cells.map((cell,index)=>{
    const row = Math.floor(index/columns), col = index%columns;
    const y = y0+heights.slice(0,row).reduce((a,b)=>a+b,0)+row*gapY+(heights[row]-cell.hr)/2;
    return {id:++sigSeq,page,xr:x0+col*(cellW+gapX)+(cellW-cell.wr)/2,yr:y,wr:cell.wr,signature:{...cell.s}};
  });
}
function pageClick(e,wrap){
  if(e.target.closest('.sigbox')) return;
  if(!placing){ selPlacement = null; document.querySelectorAll('.sigbox.sel').forEach(b=>b.classList.remove('sel')); return; }
  if(!placingSignatures.length) return;
  const r = wrap.getBoundingClientRect(), cx = sigClamp((e.clientX-r.left)/r.width,0,1), cy = sigClamp((e.clientY-r.top)/r.height,0,1);
  const page = +wrap.dataset.page, sigs = placingSignatures, repeat = placingRepeat, last = placingLastPages;
  const targetPages = repeat ? signPageDims.map((_,index)=>index) : last ? signSources.map(source=>source.end-1) : [page];
  targetPages.forEach(p=>signPlacements.push(...signatureGroupPositions(sigs,p,cx,cy)));
  const lastOnThisPage = signPlacements.filter(p=>p.page===page).at(-1); selPlacement = lastOnThisPage?.id || null;
  cancelPlacing(); renderPlacements();
  toast('✅ '+sigs.length+' assinatura(s) posicionada(s)'+(repeat?' em todas as páginas.':last?' na última página de cada PDF.':'.')+' Arraste para ajustar.');
}
function renderPlacements(){
  document.querySelectorAll('#sign-pages .sigbox').forEach(b=>b.remove());
  signPlacements.forEach(pl=>{
    const wrap = document.querySelector('.spage[data-page="'+pl.page+'"]'); if(!wrap) return;
    const box = document.createElement('div'); box.className = 'sigbox'+(selPlacement===pl.id?' sel':''); box.dataset.id = pl.id;
    box.setAttribute('aria-label','Assinatura de '+pl.signature.name+' na página '+(pl.page+1));
    const updateBox = ()=>{
      box.style.left = pl.xr*100+'%'; box.style.top = pl.yr*100+'%'; box.style.width = pl.wr*100+'%'; box.style.height = signatureHeightFraction(pl)*100+'%';
    }; updateBox();
    const img = document.createElement('img'); img.src = pl.signature.dataURL; img.alt = pl.signature.name; img.draggable = false;
    const label = document.createElement('span'); label.className = 'sig-person'; label.textContent = pl.signature.name;
    const resize = document.createElement('button'); resize.className = 'rs'; resize.setAttribute('aria-label','Redimensionar '+pl.signature.name);
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.setAttribute('aria-label','Remover assinatura de '+pl.signature.name+' desta página');
    del.onclick = ev=>{ ev.stopPropagation(); signPlacements = signPlacements.filter(p=>p.id!==pl.id); if(selPlacement===pl.id) selPlacement=null; renderPlacements(); };
    box.append(img,label,resize,del);
    const beginPointer = (ev,isResize)=>{
      if(ev.button!==0 || ev.target.closest('.del')) return;
      ev.preventDefault(); ev.stopPropagation(); cancelPlacing(); selPlacement = pl.id;
      document.querySelectorAll('#sign-pages .sigbox').forEach(b=>b.classList.toggle('sel',+b.dataset.id===pl.id));
      const r = wrap.getBoundingClientRect(), sx=ev.clientX,sy=ev.clientY,ox=pl.xr,oy=pl.yr,ow=pl.wr;
      const aspect = (pl.signature.h/pl.signature.w)*(signPageDims[pl.page].w/signPageDims[pl.page].h);
      box.setPointerCapture(ev.pointerId);
      const mv = e2=>{
        if(isResize){
          const maxW = Math.min(.95,1-pl.xr,(1-pl.yr)/Math.max(aspect,.001));
          const delta = (e2.clientX-sx)/r.width;
          pl.wr = sigClamp(ow+delta,Math.min(.035,maxW),maxW);
        }else{
          pl.xr = sigClamp(ox+(e2.clientX-sx)/r.width,0,1-pl.wr);
          pl.yr = sigClamp(oy+(e2.clientY-sy)/r.height,0,1-signatureHeightFraction(pl));
        }
        updateBox();
      };
      const up = ()=>{ box.removeEventListener('pointermove',mv); box.removeEventListener('pointerup',up); box.removeEventListener('pointercancel',up); };
      box.addEventListener('pointermove',mv); box.addEventListener('pointerup',up); box.addEventListener('pointercancel',up);
    };
    box.addEventListener('pointerdown',ev=>{ if(!ev.target.closest('.rs')) beginPointer(ev,false); });
    resize.addEventListener('pointerdown',ev=>beginPointer(ev,true));
    wrap.append(box);
  });
  updateSignBar();
}
function signaturePdfPoint(x,y,transform){
  const [a,b,c,d,e,f] = transform, det=a*d-b*c;
  return [(d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det];
}
async function doSign(){
  if(!signFile || !signPlacements.length) return;
  const covered=new Set(signPlacements.map(p=>signPageDims[p.page]?.sourceId));
  const missing=signSources.filter(source=>!covered.has(source.id));
  if(missing.length && !confirm('Há '+missing.length+' PDF(s) sem assinatura posicionada: '+missing.map(s=>s.name).join(', ')+'. Baixar o lote mesmo assim?'))return;
  cancelPlacing(); const placements = signPlacements.map(p=>({...p,signature:{...p.signature}}));
  $('#sign-go').disabled = true; overlay(true,'Aplicando as assinaturas…','Cada pessoa mantém sua própria assinatura. O PDF original não é rasterizado.');
  try{
    const doc = await PDFDocument.load(signFile.bytes,{ignoreEncryption:true,updateMetadata:false}), pages=doc.getPages(), images=new Map();
    for(let i=0;i<placements.length;i++){
      const pl = placements[i], s=pl.signature, dims=signPageDims[pl.page];
      let png = images.get(s.dataURL);
      if(!png){ png = await doc.embedPng(signaturePngBytes(s.dataURL)); images.set(s.dataURL,png); }
      const x=pl.xr*dims.w, y=pl.yr*dims.h, w=pl.wr*dims.w, h=w*(s.h/s.w);
      // Mapeia a prévia de volta ao espaço PDF, incluindo /Rotate e CropBox.
      const p0=signaturePdfPoint(x,y+h,dims.transform), p1=signaturePdfPoint(x+w,y+h,dims.transform), p2=signaturePdfPoint(x,y,dims.transform);
      const width=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]), height=Math.hypot(p2[0]-p0[0],p2[1]-p0[1]);
      const angle=Math.atan2(p1[1]-p0[1],p1[0]-p0[0])*180/Math.PI;
      pages[pl.page].drawImage(png,{x:p0[0],y:p0[1],width,height,rotate:degrees(angle)});
      prog((i+1)/placements.length);
    }
    const bytes=await doc.save({useObjectStreams:false});
    download(bytes,signSources.length>1?'documentos_assinados.pdf':signFile.name.replace(/\.pdf$/i,'')+'_assinado.pdf');
    toast('✅ PDF pronto com '+placements.length+' assinatura(s)!');
  }catch(e){ console.error(e); toast('Erro ao assinar: '+e.message,true); }
  finally{ overlay(false); updateSignBar(); }
}

/* ================= Criador: nome, desenho, foto ================= */
function openSigModal(tab='type'){
  if(sigLibrary.length>=SIGNATURE_MAX){ toast('Limite de 10 assinaturas. Exclua uma para cadastrar outra.',true); return false; }
  cancelPlacing(); clearTimeout($('#toast')._h); $('#toast').className=''; sigModalFocus = document.activeElement;
  $('#sig-person-name').value=''; $('#sig-type-input').value=''; clearDraw(); resetSigPhoto();
  selFont=0; penColor='#111111'; document.querySelectorAll('.sig-pen-options .pen').forEach((b,i)=>{ b.classList.toggle('sel',i===0); b.setAttribute('aria-pressed',i===0?'true':'false'); });
  $('#sigmodal').classList.add('on'); document.body.classList.add('sig-modal-open'); sigTab(['type','draw','img'].includes(tab)?tab:'type');
  renderFontOpts(); $('#sig-person-name').focus();
  Promise.all(SIGFONTS.map(f=>document.fonts.load('42px '+f.family))).then(()=>{ if($('#sigmodal').classList.contains('on')) renderFontOpts(); }).catch(()=>toast('Não foi possível carregar uma fonte. Confira a pasta vendor/fonts.',true));
  return true;
}
function closeSigModal(){
  if(sigSaving) return;
  sigPhotoLoadVersion++; sigPhotoVersion++; clearTimeout(sigPhotoTimer); sigPhotoBusy=false;
  $('#sigmodal').classList.remove('on'); if(!$('#sig-manage-modal').classList.contains('on')) document.body.classList.remove('sig-modal-open');
  if(sigModalFocus?.isConnected) sigModalFocus.focus(); else $('#sig-new-btn').focus();
}
function sigTab(t){
  sigTabCur=t;
  ['draw','type','img'].forEach(x=>{ $('#smtab-'+x).classList.toggle('active',x===t); $('#smtab-'+x).setAttribute('aria-selected',x===t?'true':'false'); $('#smpanel-'+x).classList.toggle('active',x===t); });
  $('#sig-pen-row').hidden=t==='img'; updateSigSaveButton();
}
function setPen(color,el){
  penColor=color; document.querySelectorAll('.sig-pen-options .pen').forEach(b=>{ b.classList.toggle('sel',b===el); b.setAttribute('aria-pressed',b===el?'true':'false'); }); renderFontOpts();
}
function signatureTypedName(){ return ($('#sig-type-input').value.trim() || $('#sig-person-name').value.trim()).slice(0,80); }
function renderFontOpts(){
  const name=signatureTypedName() || 'Sua assinatura', box=$('#fontopts'); box.replaceChildren();
  const targetW=Math.max(90,(box.clientWidth || 580)/2-30), measure=document.createElement('canvas').getContext('2d');
  SIGFONTS.forEach((f,i)=>{
    const opt=document.createElement('button'); opt.type='button'; opt.className='fopt'+(i===selFont?' sel':''); opt.setAttribute('aria-pressed',i===selFont?'true':'false'); opt.setAttribute('aria-label','Estilo '+f.label);
    measure.font='42px '+f.family; const textWidth=measure.measureText(name).width;
    const sample=document.createElement('span'); sample.className='font-sample'; sample.style.fontFamily=f.family; sample.style.fontSize=Math.max(12,Math.min(42,42*targetW/Math.max(textWidth,1)))+'px'; sample.style.color=penColor; sample.textContent=name;
    const title=document.createElement('small'); title.textContent=f.label;
    opt.append(sample,title); opt.onclick=()=>{ selFont=i; renderFontOpts(); }; box.append(opt);
  });
}
function sigDrawPoint(e){ const r=sigDrawCanvas.getBoundingClientRect(); return {x:sigClamp((e.clientX-r.left)*sigDrawCanvas.width/r.width,0,sigDrawCanvas.width),y:sigClamp((e.clientY-r.top)*sigDrawCanvas.height/r.height,0,sigDrawCanvas.height)}; }
function strokeSignatureLine(stroke){
  const ctx=sigDrawContext; ctx.lineWidth=5; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=stroke.color; ctx.fillStyle=stroke.color;
  if(stroke.points.length===1){ ctx.beginPath(); ctx.arc(stroke.points[0].x,stroke.points[0].y,2.5,0,2*Math.PI); ctx.fill(); return; }
  ctx.beginPath(); ctx.moveTo(stroke.points[0].x,stroke.points[0].y); stroke.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
}
function clearDraw(){ sigDrawContext.clearRect(0,0,sigDrawCanvas.width,sigDrawCanvas.height); sigDrawStrokes=[]; sigDrawingStroke=null; }
function undoSigDraw(){ sigDrawStrokes.pop(); sigDrawingStroke=null; sigDrawContext.clearRect(0,0,sigDrawCanvas.width,sigDrawCanvas.height); sigDrawStrokes.forEach(strokeSignatureLine); }
sigDrawCanvas.addEventListener('pointerdown',e=>{
  if(e.button!==0) return; e.preventDefault(); sigDrawCanvas.setPointerCapture(e.pointerId);
  sigDrawingStroke={color:penColor,points:[sigDrawPoint(e)],pointer:e.pointerId}; sigDrawStrokes.push(sigDrawingStroke); strokeSignatureLine(sigDrawingStroke);
});
sigDrawCanvas.addEventListener('pointermove',e=>{
  if(!sigDrawingStroke || e.pointerId!==sigDrawingStroke.pointer) return; e.preventDefault();
  const point=sigDrawPoint(e), prev=sigDrawingStroke.points.at(-1); sigDrawingStroke.points.push(point);
  sigDrawContext.beginPath(); sigDrawContext.strokeStyle=sigDrawingStroke.color; sigDrawContext.lineWidth=5; sigDrawContext.lineCap='round'; sigDrawContext.moveTo(prev.x,prev.y); sigDrawContext.lineTo(point.x,point.y); sigDrawContext.stroke();
});
['pointerup','pointercancel','lostpointercapture'].forEach(t=>sigDrawCanvas.addEventListener(t,()=>sigDrawingStroke=null));
function trimCanvas(canvas,pad=8){
  const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
  for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(data[(y*canvas.width+x)*4+3]>18){ minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y); }
  if(maxX<0) return null;
  const out=document.createElement('canvas'); out.width=maxX-minX+1+pad*2; out.height=maxY-minY+1+pad*2;
  out.getContext('2d').drawImage(canvas,minX,minY,maxX-minX+1,maxY-minY+1,pad,pad,maxX-minX+1,maxY-minY+1); return out;
}
function limitSignatureCanvas(canvas){
  const scale=Math.min(1,1600/canvas.width,1600/canvas.height);
  if(scale===1) return canvas;
  const out=document.createElement('canvas'); out.width=Math.max(1,Math.round(canvas.width*scale)); out.height=Math.max(1,Math.round(canvas.height*scale)); out.getContext('2d').drawImage(canvas,0,0,out.width,out.height); return out;
}
async function makeTypedSignature(){
  const name=signatureTypedName(); if(!name) throw new Error('Digite o nome ou o texto da assinatura.');
  const family=SIGFONTS[selFont].family, color=penColor;
  const loaded=await document.fonts.load('150px '+family); if(!loaded.length) throw new Error('A fonte não carregou. Confira os arquivos do site.');
  const measure=document.createElement('canvas').getContext('2d'); measure.font='150px '+family;
  const metrics=measure.measureText(name), left=Math.max(0,metrics.actualBoundingBoxLeft||0), right=Math.max(metrics.width,metrics.actualBoundingBoxRight||0);
  const top=Math.max(180,metrics.actualBoundingBoxAscent||0), bottom=Math.max(160,metrics.actualBoundingBoxDescent||0);
  const width=Math.ceil(left+right+80), height=Math.ceil(top+bottom+80), scale=Math.min(1,8000/width);
  const canvas=document.createElement('canvas'); canvas.width=Math.ceil(width*scale); canvas.height=Math.ceil(height*scale);
  const ctx=canvas.getContext('2d'); ctx.scale(scale,scale); ctx.font='150px '+family; ctx.fillStyle=color; ctx.textBaseline='alphabetic'; ctx.fillText(name,left+40,top+40);
  return trimCanvas(canvas);
}
function updateSigSaveButton(){ $('#sig-save-btn').disabled=sigSaving || (sigTabCur==='img' && sigPhotoBusy); $('#sig-save-btn').textContent=sigSaving?'Salvando…':'Salvar assinatura'; }
async function saveSignature(){
  if(sigSaving) return;
  const name=$('#sig-person-name').value.trim().slice(0,80); if(!name){ toast('Informe o nome da pessoa para identificar a assinatura.',true); $('#sig-person-name').focus(); return; }
  const sourceKind=sigTabCur; sigSaving=true; updateSigSaveButton();
  try{
    await signatureLibraryReady;
    let canvas;
    if(sourceKind==='type') canvas=await makeTypedSignature();
    else if(sourceKind==='draw'){
      if(!sigDrawStrokes.length) throw new Error('Desenhe a assinatura primeiro.'); canvas=trimCanvas(sigDrawCanvas);
    }else{
      if(!sigPhotoCanvas) throw new Error('Escolha uma foto da assinatura primeiro.');
      if(sigPhotoBusy){ await processSigPhotoNow(); }
      canvas=sigProcessedCanvas;
    }
    if(!canvas) throw new Error('Não encontrei uma assinatura. Ajuste o recorte e a limpeza da foto.');
    canvas=limitSignatureCanvas(canvas);
    const signature={id:sigNewId(),name,kind:sourceKind,dataURL:canvas.toDataURL('image/png'),w:canvas.width,h:canvas.height,createdAt:Date.now()};
    await updateSignatureStorage(current=>{
      if(current.length>=SIGNATURE_MAX) throw new Error('Limite de 10 assinaturas atingido. Exclua uma antes de cadastrar outra.'); return current.concat(signature);
    });
    sigSelected.add(signature.id); renderSignatureLibrary(); updateSignBar();
    sigSaving=false; closeSigModal();
    toast(sigStorage.mode==='memory'?'Assinatura pronta nesta sessão. Exporte um backup para não perder.':'✅ Assinatura de '+name+' salva. Selecione outras pessoas para posicionar juntas.');
  }catch(e){ toast(e.message,true); }
  finally{ sigSaving=false; updateSigSaveButton(); }
}

/* ================= Foto: recorte e remoção adaptativa do papel ================= */
function pickSigImage(camera=false){ const inp=camera?$('#fi-sig-camera'):$('#fi-img'); inp.value=''; inp.click(); }
[$('#fi-img'),$('#fi-sig-camera')].forEach(inp=>inp.addEventListener('change',e=>{ if(e.target.files[0]) loadSigPhoto(e.target.files[0]); }));
function resetSigPhoto(){
  clearTimeout(sigPhotoTimer); sigPhotoVersion++; sigPhotoLoadVersion++; sigPhotoBusy=false; sigPhotoCanvas=null; sigPhotoCrop=null; sigProcessedCanvas=null;
  $('#sig-photo-editor').style.display='none'; $('#sig-img-preview').removeAttribute('src'); $('#sig-img-preview').style.display='none';
  $('#sig-photo-status').textContent=''; $('#sig-photo-crop').style.display='none'; $('#sig-remove-bg').checked=true; $('#sig-bg-strength').value=50; $('#sig-bg-value').textContent='50'; $('#sig-photo-ink').value='original'; $('#sig-clean-specks').checked=true;
}
async function loadSigPhoto(file){
  const generation=++sigPhotoLoadVersion;
  try{
    if(file.size>30000000) throw new Error('Foto muito grande. Use uma imagem de até 30 MB.');
    if(!/^image\//.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('Escolha uma foto JPG, PNG ou WebP.');
    sigTab('img'); sigPhotoBusy=true; sigProcessedCanvas=null; updateSigSaveButton();
    const dataURL=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('Não foi possível ler a foto.')); reader.readAsDataURL(file); });
    const img=await decodeSignatureImage(dataURL);
    if(generation!==sigPhotoLoadVersion) return;
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.naturalWidth*scale)); c.height=Math.max(1,Math.round(img.naturalHeight*scale)); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    sigPhotoCanvas=c; sigPhotoCrop={x:0,y:0,w:c.width,h:c.height}; renderSigPhotoSource(); $('#sig-photo-editor').style.display='block';
    await processSigPhotoNow();
  }catch(e){ if(generation===sigPhotoLoadVersion){ sigPhotoBusy=false; updateSigSaveButton(); toast(e.message,true); } }
}
function renderSigPhotoSource(){
  if(!sigPhotoCanvas) return;
  const source=$('#sig-photo-source'); source.width=sigPhotoCanvas.width; source.height=sigPhotoCanvas.height; source.getContext('2d').drawImage(sigPhotoCanvas,0,0); updateSigPhotoCropOverlay();
}
function updateSigPhotoCropOverlay(){
  const crop=$('#sig-photo-crop'); if(!sigPhotoCanvas || !sigPhotoCrop){ crop.style.display='none'; return; }
  const p=sigPhotoCrop; crop.style.display='block'; crop.style.left=p.x/sigPhotoCanvas.width*100+'%'; crop.style.top=p.y/sigPhotoCanvas.height*100+'%'; crop.style.width=p.w/sigPhotoCanvas.width*100+'%'; crop.style.height=p.h/sigPhotoCanvas.height*100+'%';
}
function resetSigPhotoCrop(){ if(!sigPhotoCanvas) return; sigPhotoCrop={x:0,y:0,w:sigPhotoCanvas.width,h:sigPhotoCanvas.height}; updateSigPhotoCropOverlay(); scheduleSigPhotoProcessing(); }
function rotateSigPhoto(){
  if(!sigPhotoCanvas) return;
  const source=sigPhotoCanvas,out=document.createElement('canvas'); out.width=source.height; out.height=source.width; const ctx=out.getContext('2d'); ctx.translate(out.width,0); ctx.rotate(Math.PI/2); ctx.drawImage(source,0,0);
  sigPhotoCanvas=out; sigPhotoCrop={x:0,y:0,w:out.width,h:out.height}; renderSigPhotoSource(); scheduleSigPhotoProcessing();
}
$('#sig-photo-stage').addEventListener('pointerdown',e=>{
  if(!sigPhotoCanvas || e.button!==0) return;
  e.preventDefault(); const stage=$('#sig-photo-stage'),r=$('#sig-photo-source').getBoundingClientRect(); stage.setPointerCapture(e.pointerId);
  const pos=ev=>({x:sigClamp((ev.clientX-r.left)*sigPhotoCanvas.width/r.width,0,sigPhotoCanvas.width),y:sigClamp((ev.clientY-r.top)*sigPhotoCanvas.height/r.height,0,sigPhotoCanvas.height)});
  const start=pos(e),oldCrop={...sigPhotoCrop}; let changed=false;
  const move=ev=>{ const end=pos(ev); sigPhotoCrop={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)}; changed=sigPhotoCrop.w>=5 && sigPhotoCrop.h>=5; updateSigPhotoCropOverlay(); };
  const up=()=>{ stage.removeEventListener('pointermove',move); stage.removeEventListener('pointerup',up); stage.removeEventListener('pointercancel',up); if(!changed) sigPhotoCrop=oldCrop; updateSigPhotoCropOverlay(); scheduleSigPhotoProcessing(); };
  stage.addEventListener('pointermove',move); stage.addEventListener('pointerup',up); stage.addEventListener('pointercancel',up);
});
function scheduleSigPhotoProcessing(){
  if(!sigPhotoCanvas) return;
  sigPhotoBusy=true; sigProcessedCanvas=null; sigPhotoVersion++; $('#sig-bg-value').textContent=$('#sig-bg-strength').value; $('#sig-photo-status').textContent='Removendo o fundo…'; updateSigSaveButton();
  clearTimeout(sigPhotoTimer); sigPhotoTimer=setTimeout(()=>processSigPhotoNow(),100);
}
function removeSignaturePaper(canvas,{strength=50,removeBackground=true,ink='original',cleanSpecks=true}={}){
  const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,w,h),data=image.data;
  let transparent=0,whitePaper=0;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<245) transparent++;
    else if(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]>165) whitePaper++;
  }
  const alreadyTransparent=transparent>(w*h*.03) && whitePaper<(w*h*.03);
  // Cada bloco estima o papel claro local. Isso compensa sombras e papel
  // ligeiramente cinza/amarelado, em vez de usar um único limiar de branco.
  const cell=40,gw=Math.ceil(w/cell),gh=Math.ceil(h/cell),grid=new Float32Array(gw*gh);
  if(removeBackground && !alreadyTransparent){
    for(let gy=0;gy<gh;gy++) for(let gx=0;gx<gw;gx++){
      const hist=new Uint32Array(256); let n=0;
      for(let y=gy*cell;y<Math.min(h,(gy+1)*cell);y++) for(let x=gx*cell;x<Math.min(w,(gx+1)*cell);x++){
        const i=(y*w+x)*4;if(data[i+3]<245) continue; const l=Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]); hist[l]++;n++;
      }
      let sum=0,value=255; for(let l=0;l<256;l++){ sum+=hist[l];if(sum>=n*.92){value=l;break;} }
      grid[gy*gw+gx]=value;
    }
    const smooth=grid.slice();
    for(let gy=0;gy<gh;gy++) for(let gx=0;gx<gw;gx++){
      let value=grid[gy*gw+gx];
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(gx+dx>=0&&gx+dx<gw&&gy+dy>=0&&gy+dy<gh) value=Math.max(value,grid[(gy+dy)*gw+gx+dx]-6);
      smooth[gy*gw+gx]=value;
    }
    grid.set(smooth);
  }
  const threshold=10+strength*.48,solid=105+strength*.25;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*4,originalAlpha=data[i+3]/255;
    if(!originalAlpha) continue;
    let alpha=originalAlpha,background=255;
    if(removeBackground && !alreadyTransparent){
      const fx=sigClamp(x/cell-.5,0,gw-1),fy=sigClamp(y/cell-.5,0,gh-1),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(gw-1,x0+1),y1=Math.min(gh-1,y0+1),tx=fx-x0,ty=fy-y0;
      background=grid[y0*gw+x0]*(1-tx)*(1-ty)+grid[y0*gw+x1]*tx*(1-ty)+grid[y1*gw+x0]*(1-tx)*ty+grid[y1*gw+x1]*tx*ty;
      const lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2],contrast=(background-lum)*255/Math.max(background,30);
      alpha=originalAlpha*sigClamp((contrast-threshold)/Math.max(1,solid-threshold),0,1);
      if(alpha<.035){ data[i+3]=0;continue; }
    }
    if(ink==='black'){ data[i]=17;data[i+1]=17;data[i+2]=17; }
    else if(ink==='blue'){ data[i]=26;data[i+1]=63;data[i+2]=181; }
    else if(removeBackground && !alreadyTransparent){
      // Retira também a mistura branca nas bordas (evita halos no PDF).
      for(let ch=0;ch<3;ch++){ const normalized=sigClamp(data[i+ch]*255/Math.max(background,30),0,255); data[i+ch]=sigClamp((normalized-255*(1-alpha))/Math.max(alpha,.05),0,255); }
    }
    data[i+3]=Math.round(alpha*255);
  }
  if(cleanSpecks && removeBackground){
    // Remove apenas componentes minúsculos. Pontos de letras e cruzamentos
    // da assinatura são mantidos; não há reconhecimento/invenção de traços.
    const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
    for(let start=0;start<w*h;start++){
      if(seen[start] || data[start*4+3]<25) continue;
      let head=0,tail=1;queue[0]=start;seen[start]=1;
      while(head<tail){
        const at=queue[head++],x=at%w,y=Math.floor(at/w);
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
          const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const next=ny*w+nx;
          if(!seen[next]&&data[next*4+3]>=25){seen[next]=1;queue[tail++]=next;}
        }
      }
      if(tail<=4) for(let n=0;n<tail;n++) data[queue[n]*4+3]=0;
    }
  }
  ctx.putImageData(image,0,0); return canvas;
}
async function processSigPhotoNow(){
  clearTimeout(sigPhotoTimer);
  if(!sigPhotoCanvas || !sigPhotoCrop) return;
  const version=++sigPhotoVersion;sigPhotoBusy=true;updateSigSaveButton();$('#sig-photo-status').textContent='Removendo o fundo…';$('#sig-photo-status').className='';
  // Deixa o navegador pintar o estado antes de ler os pixels da foto.
  await new Promise(r=>requestAnimationFrame(r));
  if(version!==sigPhotoVersion || !sigPhotoCanvas) return;
  try{
    const p=sigPhotoCrop,c=document.createElement('canvas');c.width=Math.max(1,Math.round(p.w));c.height=Math.max(1,Math.round(p.h));c.getContext('2d').drawImage(sigPhotoCanvas,p.x,p.y,p.w,p.h,0,0,c.width,c.height);
    removeSignaturePaper(c,{strength:+$('#sig-bg-strength').value,removeBackground:$('#sig-remove-bg').checked,ink:$('#sig-photo-ink').value,cleanSpecks:$('#sig-clean-specks').checked});
    sigProcessedCanvas=trimCanvas(c);
    if(sigProcessedCanvas){
      sigProcessedCanvas=limitSignatureCanvas(sigProcessedCanvas);const pv=$('#sig-img-preview');pv.src=sigProcessedCanvas.toDataURL('image/png');pv.style.display='block';
      $('#sig-photo-status').textContent=$('#sig-remove-bg').checked?'Fundo removido. Confira o resultado; se houver sombras ou marcas, recorte mais perto e ajuste “Limpeza”.':'Fundo mantido. Ative “Remover fundo” para ter uma assinatura transparente.';
    }else{
      $('#sig-img-preview').style.display='none';$('#sig-photo-status').textContent='Não encontrei tinta neste recorte. Reduza a limpeza ou selecione a assinatura na foto.';$('#sig-photo-status').className='error';
    }
  }catch(e){sigProcessedCanvas=null;toast('Erro ao preparar a foto: '+e.message,true);}
  finally{if(version===sigPhotoVersion){sigPhotoBusy=false;updateSigSaveButton();}}
}

/* Teclado, foco e fechamento de modais. */
[$('#sigmodal'),$('#sig-manage-modal')].forEach(modal=>modal.addEventListener('click',e=>{ if(e.target===modal){if(modal.id==='sigmodal')closeSigModal();else closeSigManage();} }));
document.addEventListener('keydown',e=>{
  const modal=$('#sigmodal').classList.contains('on')?$('#sigmodal'):($('#sig-manage-modal').classList.contains('on')?$('#sig-manage-modal'):null);
  if(e.key==='Escape'){if(modal){if(modal.id==='sigmodal')closeSigModal();else closeSigManage();}else cancelPlacing();}
  if(modal && e.key==='Tab'){
    const focusable=[...modal.querySelectorAll('button:not(:disabled),input:not([hidden]),select,a[href]')].filter(el=>el.getClientRects().length);
    if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }
  if(!modal && $('#view-sign').classList.contains('active') && ['Delete','Backspace'].includes(e.key) && !e.target.closest('input,textarea,select,[contenteditable]') && selPlacement!==null){
    e.preventDefault();signPlacements=signPlacements.filter(p=>p.id!==selPlacement);selPlacement=null;renderPlacements();
  }
});
const signatureLibraryReady = initSignatureLibrary();
