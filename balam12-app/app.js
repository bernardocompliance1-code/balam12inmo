import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,onSnapshot,addDoc,setDoc,updateDoc,deleteDoc} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {FIREBASE_CONFIG,ADMIN_EMAILS} from "./firebase-config.js";

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
function h(tag,attrs,...kids){
  const e=document.createElement(tag);let pv;
  for(const k in (attrs||{})){const v=attrs[k];if(v==null||v===false)continue;
    if(k==='class')e.className=v;else if(k==='value')pv=v;else if(k==='checked')e.checked=true;
    else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?'':v);}
  for(const c of kids.flat(9)){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)));}
  if(pv!=null)e.value=pv;return e;}
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const mins=hm=>{const [a,b]=hm.split(':').map(Number);return a*60+b};
const fmtFecha=s=>new Date(s+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const byName=(a,b)=>(a.nombre||'').localeCompare(b.nombre||'','es');
const waLink=(tel,txt)=>{let d=String(tel||'').replace(/\D/g,'');if(d.length===10)d='52'+d;return d?'https://wa.me/'+d+'?text='+encodeURIComponent(txt):null};

/* ---------- Firebase (capa de datos en tiempo real) ---------- */
const app0=initializeApp(FIREBASE_CONFIG);
const auth=getAuth(app0);
const fdb=initializeFirestore(app0,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
const refw=r=>({id:r.id,set:d=>setDoc(r,d),update:d=>updateDoc(r,d),delete:()=>deleteDoc(r)});
const db={
  collection(name){return{
    onSnapshot(cb,err){return onSnapshot(collection(fdb,name),s=>cb({docs:s.docs.map(d=>({id:d.id,data:()=>d.data()}))}),err)},
    doc(id){return refw(id?doc(fdb,name,id):doc(collection(fdb,name)))},
    async add(data){const r=await addDoc(collection(fdb,name),data);return{id:r.id}}}},
  doc(path){const [c,i]=path.split('/');return refw(doc(fdb,c,i))}};

const S={clientes:[],inmuebles:[],citas:[],usuarios:[],names:{},loaded:{},tab:'agenda',fecha:ymd(new Date()),
  auth:null,uid:null,isAdmin:false,me:null,access:false,err:null,subscribed:false,soloMias:false,qCli:'',qInm:'',fInm:'todos',slow:false};
let creating=false,lastCount=0,installEv=null,unsubMe=null,unsubs=[];const notified=new Set();

function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',3500)}
async function run(fn){try{await fn();return true}catch(e){toast(e&&e.code==='permission-denied'?'No tienes permiso para esta acción.':'No se pudo guardar: '+((e&&e.message)||'error'));return false}}
function modal(title,body,actions){
  const ov=h('div',{class:'ov'});const close=()=>ov.remove();
  ov.append(h('div',{class:'box',role:'dialog','aria-label':title},h('h3',null,title),body,
    h('div',{class:'acts'},actions.map(a=>h('button',{class:'btn '+(a.cls||''),onclick:()=>a.fn(close)},a.label)))));
  $('#modal').append(ov);return close}
const confirmar=(msg,ok,fn)=>modal('Confirmar',h('p',null,msg),[{label:'Cancelar',fn:c=>c()},{label:ok,cls:'bad',fn:async c=>{c();await fn()}}]);

/* ---------- lógica ---------- */
const cli=id=>S.clientes.find(c=>c.id===id);
const inm=id=>S.inmuebles.find(c=>c.id===id);
function motivoTxt(c){const i=inm(c.inmuebleId);
  if(c.motivo==='mostrar')return 'Mostrar inmueble: '+(i?i.ubicacion:'(inmueble eliminado)');
  if(c.motivo==='tramite')return 'Trámite: '+(c.tramite||'');
  if(c.motivo==='oficina')return 'Oficina – '+(c.oficinaTipo==='firma'?'Firma':'Reunión');
  if(c.motivo==='primera')return '1ª visita';return ''}
function conflictos(c,ignoreId){const out=[];
  for(const o of S.citas){if(o.id===ignoreId||o.fecha!==c.fecha)continue;
    const d=Math.abs(mins(o.hora)-mins(c.hora));
    if(d===0)out.push({t:'misma',d,o});else if(d<=30)out.push({t:'cerca',d,o});}
  return out}
const conflTxt=x=>{const n=(cli(x.o.clienteId)||{}).nombre||'cliente';
  return x.t==='misma'?`Ya hay una cita programada a las ${x.o.hora} (${n}).`:`Poco tiempo entre citas: hay otra a las ${x.o.hora} (${n}), a ${x.d} min de diferencia.`};
const userTel=id=>(S.usuarios.find(u=>u.id===id)||{}).telefono;

function recordatorios(){
  const out=[],now=Date.now();
  for(const c of S.citas){
    if(!(S.isAdmin||c.usuarioId===S.uid))continue;
    const ms=new Date(c.fecha+'T'+c.hora).getTime()-now;
    if(ms<-15*60000||ms>24*3600000)continue;
    const k=cli(c.clienteId);
    if(c.avisoCliente&&!c.recCliente&&k){
      const txt=`Hola ${k.nombre}, le recordamos su cita en BALAM12 INMOBILIARIA hoy a las ${c.hora} (${motivoTxt(c)}). Si necesita reprogramar, responda a este mensaje. ¡Lo esperamos!`;
      out.push({c,tipo:'cliente',para:k.nombre,due:ms<=30*60000,min:30,txt,link:waLink(k.telefono,txt),campo:'recCliente'});}
    const ut=userTel(c.usuarioId);
    if(ut&&!c.recUsuario){
      const txt=`Recordatorio BALAM12: tienes cita a las ${c.hora} con ${k?k.nombre:'cliente'} (${motivoTxt(c)}).`;
      out.push({c,tipo:'usuario',para:S.names[c.usuarioId]||'Usuario',due:ms<=60*60000,min:60,txt,link:waLink(ut,txt),campo:'recUsuario'});}
  }
  return out.sort((a,b)=>(a.c.fecha+a.c.hora).localeCompare(b.c.fecha+b.c.hora))}

async function notificar(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  for(const r of recordatorios().filter(x=>x.due)){
    const key=r.c.id+r.tipo;if(notified.has(key))continue;notified.add(key);
    const t='Enviar recordatorio a '+(r.tipo==='cliente'?r.para:'ti');const o={body:`Cita de las ${r.c.hora} · ${motivoTxt(r.c)}`,icon:'icons/icon-192.png',tag:key};
    try{const reg=await navigator.serviceWorker.ready;reg.showNotification(t,o)}catch(e){try{new Notification(t,o)}catch(_){}}}}

/* ---------- datos en tiempo real ---------- */
function sub(name,key){unsubs.push(db.collection(name).onSnapshot(s=>{
  S[key]=s.docs.map(d=>({id:d.id,...d.data()}));S.loaded[key]=true;
  if(key==='usuarios'){S.names={};S.usuarios.forEach(u=>S.names[u.id]=u.nombre||u.email||'Usuario')}
  render()},e=>{S.err=e.code;render()}))}

onAuthStateChanged(auth,u=>{
  if(unsubMe){unsubMe();unsubMe=null}
  unsubs.forEach(f=>f());unsubs=[];S.subscribed=false;S.usuarios=[];S.clientes=[];S.inmuebles=[];S.citas=[];
  creating=false;S.auth=u;S.uid=u?u.uid:null;S.me=null;S.access=false;S.isAdmin=false;S.loaded={};S.err=null;
  if(!u){render();return}
  const esAdminMail=u.emailVerified&&ADMIN_EMAILS.map(x=>x.toLowerCase()).includes((u.email||'').toLowerCase());
  unsubMe=onSnapshot(doc(fdb,'usuarios',u.uid),{includeMetadataChanges:true},async snap=>{
    if(!snap.exists()){
      if(snap.metadata.fromCache||creating)return;creating=true;
      await run(()=>setDoc(doc(fdb,'usuarios',u.uid),{uid:u.uid,nombre:u.displayName||u.email,email:u.email,telefono:'',
        rol:esAdminMail?'Administrador':'Agente',estado:esAdminMail?'activo':'pendiente'}));return}
    S.me={id:snap.id,...snap.data()};S.loaded.me=true;
    S.access=S.me.estado==='activo';S.isAdmin=S.access&&S.me.rol==='Administrador';
    if(!S.access&&S.subscribed){unsubs.forEach(f=>f());unsubs=[];S.subscribed=false;S.err=null;S.usuarios=[];S.clientes=[];S.inmuebles=[];S.citas=[]}
    if(S.access&&!S.subscribed){S.subscribed=true;sub('usuarios','usuarios');sub('clientes','clientes');sub('inmuebles','inmuebles');sub('citas','citas')}
    render()},e=>{S.err=e.code;render()});
});

/* ---------- vistas ---------- */
async function entrar(){const p=new GoogleAuthProvider();
  try{await signInWithPopup(auth,p)}catch(e){if(e.code!=='auth/popup-closed-by-user'){try{await signInWithRedirect(auth,p)}catch(_){toast('No se pudo iniciar sesión.')}}}}
async function salir(){await signOut(auth)}

function header(){
  return h('header',null,h('div',null,h('b',null,'BALAM12'),h('small',null,'INMOBILIARIA · AGENDA')),
    S.auth?h('span',{class:'chip'},S.me?(S.isAdmin?'Administrador':S.me.rol)+' · '+(S.me.nombre||''):S.auth.email):null,
    installEv?h('button',{class:'hbtn',onclick:async()=>{installEv.prompt();await installEv.userChoice;installEv=null;render()}},'Instalar app'):null,
    S.access&&'Notification' in window&&Notification.permission==='default'?h('button',{class:'hbtn',onclick:async()=>{await Notification.requestPermission();render()}},'Activar avisos'):null,
    S.access?h('button',{class:'hbtn',onclick:miTel},'Mi teléfono'):null,
    S.auth?h('button',{class:'hbtn',onclick:salir},'Salir'):null)}

function miTel(){
  const t=h('input',{type:'tel',value:S.me.telefono||'',placeholder:'10 dígitos'});
  modal('Mi teléfono de WhatsApp',h('div',null,h('p',{class:'muted'},'Aquí recibirás tus recordatorios de citas (1 hora antes).'),t),
    [{label:'Cancelar',fn:x=>x()},{label:'Guardar',cls:'pri',fn:async c=>{if(await run(()=>db.doc('usuarios/'+S.uid).update({telefono:t.value.trim()})))c()}}])}

function render(){
  const ae=document.activeElement;if(ae&&ae.matches&&ae.matches('#app input[placeholder^="Buscar"]'))return;
  const a=$('#app');a.replaceChildren();
  if(!S.auth){a.append(h('div',{class:'login'},h('img',{src:'icons/icon-192.png',alt:''}),h('h1',null,'BALAM12'),h('p',{class:'muted'},'Agenda inmobiliaria'),
    h('button',{class:'btn pri',style:'margin-top:16px;padding:12px 20px',onclick:entrar},'Iniciar sesión con Google')));return}
  a.append(header());
  if(S.err&&!S.access){a.append(h('p',{class:'pad'},'Error ('+S.err+'). Revisa la configuración de Firebase y las reglas.'));return}
  if(!S.loaded.me){a.append(h('p',{class:'pad muted'},'Cargando…'));return}
  if(!S.access){a.append(h('div',{class:'login'},h('h3',null,S.me&&S.me.estado==='bloqueado'?'Acceso bloqueado':'Pendiente de autorización'),
    h('p',{class:'muted'},S.me&&S.me.estado==='bloqueado'?'Contacta al administrador.':'El administrador debe autorizar tu cuenta. Esta pantalla se actualizará sola cuando lo haga.')));return}
  const rec=recordatorios().filter(r=>r.due);lastCount=rec.length;
  const pend=S.usuarios.filter(u=>u.estado==='pendiente').length;
  const tabs=[['agenda','Agenda'],['inmuebles','Inmuebles'],['clientes','Clientes'],['recordatorios','Recordatorios'],...(S.isAdmin?[['usuarios','Usuarios']]:[])];
  a.append(h('nav',null,tabs.map(([k,l])=>h('button',{class:S.tab===k?'on':'',onclick:()=>{S.tab=k;render()}},l,
    k==='recordatorios'&&rec.length?h('span',{class:'badge'},rec.length):null,k==='usuarios'&&pend?h('span',{class:'badge'},pend):null))));
  const m=h('main');
  if(S.err)m.append(h('div',{class:'banner red'},'Error de datos ('+S.err+').'));
  if(rec.length&&S.tab!=='recordatorios')m.append(h('div',{class:'banner'},`Tienes ${rec.length} recordatorio(s) de WhatsApp por enviar. `,h('a',{href:'#',onclick:e=>{e.preventDefault();S.tab='recordatorios';render()}},'Ver')));
  m.append(S.tab==='agenda'?vAgenda():S.tab==='inmuebles'?vInm():S.tab==='clientes'?vCli():S.tab==='recordatorios'?vRec():S.isAdmin?vUsu():vAgenda());
  a.append(m)}

function vAgenda(){
  const w=h('div');
  w.append(h('div',{class:'bar'},
    h('button',{class:'btn',onclick:()=>{S.fecha=addDays(S.fecha,-1);render()},'aria-label':'Día anterior'},'‹'),
    h('input',{type:'date',value:S.fecha,onchange:e=>{if(e.target.value){S.fecha=e.target.value;render()}}}),
    h('button',{class:'btn',onclick:()=>{S.fecha=addDays(S.fecha,1);render()},'aria-label':'Día siguiente'},'›'),
    h('button',{class:'btn',onclick:()=>{S.fecha=ymd(new Date());render()}},'Hoy'),
    h('label',{class:'ck',style:'margin:0'},h('input',{type:'checkbox',checked:S.soloMias,onchange:e=>{S.soloMias=e.target.checked;render()}}),'Solo mis citas'),
    h('span',{class:'grow'}),h('button',{class:'btn pri',onclick:()=>citaForm()},'+ Nueva cita')));
  w.append(h('h2',{class:'cap'},fmtFecha(S.fecha)));
  const l=S.citas.filter(c=>c.fecha===S.fecha&&(!S.soloMias||c.usuarioId===S.uid)).sort((a,b)=>mins(a.hora)-mins(b.hora));
  if(!l.length)w.append(h('p',{class:'muted'},'Sin citas este día.'));
  l.forEach(c=>w.append(citaCard(c)));return w}

function citaCard(c){
  const k=cli(c.clienteId),cf=conflictos(c,c.id);
  return h('div',{class:'card'},h('div',{class:'hr'},c.hora),
    h('div',{class:'bd'},h('h4',null,k?k.nombre:'Cliente eliminado'),
      h('div',{class:'muted'},k?k.telefono:''),h('div',null,motivoTxt(c)),c.notas?h('div',{class:'muted'},c.notas):null,
      h('span',{class:'tag'},'Atiende: '+(S.names[c.usuarioId]||'—')),
      c.avisoCliente?h('span',{class:'tag ok'},'WhatsApp al cliente autorizado'):null,
      cf.some(x=>x.t==='misma')?h('span',{class:'tag bad'},'⚠ Misma hora que otra cita'):null,
      cf.some(x=>x.t==='cerca')?h('span',{class:'tag warn'},'⏱ Poco tiempo entre citas'):null),
    h('div',{class:'ac'},h('button',{class:'btn sm',onclick:()=>citaForm(c)},'Editar'),
      h('button',{class:'btn sm bad',onclick:()=>confirmar('¿Eliminar esta cita?','Eliminar',()=>run(()=>db.doc('citas/'+c.id).delete()))},'Eliminar')))}

function clientePicker(sel){
  const s=h('select',null,h('option',{value:''},'— Seleccionar —'),[...S.clientes].sort(byName).map(c=>h('option',{value:c.id},c.nombre+' · '+c.telefono)),h('option',{value:'__n'},'+ Cliente nuevo…'));
  s.value=sel||'';
  const n=h('input',{placeholder:'Nombre completo'}),t=h('input',{placeholder:'Teléfono (10 dígitos)',type:'tel'});
  const box=h('div',{class:'row2 hide'},n,t);
  s.onchange=()=>box.classList.toggle('hide',s.value!=='__n');
  return{node:h('div',null,s,box),
    async get(){if(s.value==='__n'){const nm=n.value.trim(),tl=t.value.trim();if(!nm||!tl)return null;const r=await db.collection('clientes').add({nombre:nm,telefono:tl});return r.id}return s.value||null}}}

function citaForm(c0){
  const ed=!!c0,c=c0||{fecha:S.fecha,hora:'10:00',motivo:'mostrar',oficinaTipo:'reunion',usuarioId:S.uid,avisoCliente:false};
  const fecha=h('input',{type:'date',value:c.fecha}),hora=h('input',{type:'time',value:c.hora});
  const cp=clientePicker(c.clienteId);
  const mot=h('select',null,[['mostrar','Mostrar inmueble'],['tramite','Trámite'],['oficina','Oficina (reunión o firma)'],['primera','1ª visita']].map(([v,l])=>h('option',{value:v},l)));mot.value=c.motivo;
  const disp=S.inmuebles.filter(i=>i.estado!=='vendido'||i.id===c.inmuebleId);
  const sInm=h('select',null,h('option',{value:''},'— Seleccionar inmueble —'),disp.map(i=>h('option',{value:i.id},i.ubicacion)));sInm.value=c.inmuebleId||'';
  const tram=h('textarea',{placeholder:'Descripción del trámite'},c.tramite||'');
  const ofi=h('select',null,h('option',{value:'reunion'},'Reunión'),h('option',{value:'firma'},'Firma'));ofi.value=c.oficinaTipo||'reunion';
  const bt=h('div'),bo=h('div'),bi=h('div');
  bi.append(h('label',null,'Inmueble a mostrar'),sInm,disp.length?null:h('p',{class:'muted'},'No hay inmuebles disponibles.'));
  bt.append(h('label',null,'Descripción del trámite'),tram);bo.append(h('label',null,'Tipo en oficina'),ofi);
  const sync=()=>{bi.classList.toggle('hide',mot.value!=='mostrar');bt.classList.toggle('hide',mot.value!=='tramite');bo.classList.toggle('hide',mot.value!=='oficina')};
  mot.onchange=sync;sync();
  const resp=S.usuarios.filter(u=>u.estado==='activo').map(u=>({id:u.id,n:u.nombre||u.email||'Usuario'}));
  for(const id of [S.uid,c.usuarioId])if(id&&!resp.some(r=>r.id===id))resp.push({id,n:S.names[id]||'Usuario'});
  const sr=h('select',null,resp.map(r=>h('option',{value:r.id},r.n)));sr.value=c.usuarioId||S.uid;
  const notas=h('textarea',{placeholder:'Notas (opcional)'},c.notas||'');
  const av=h('input',{type:'checkbox',checked:!!c.avisoCliente});
  const body=h('div',null,h('div',{class:'row2'},h('div',null,h('label',null,'Día'),fecha),h('div',null,h('label',null,'Hora'),hora)),
    h('label',null,'Cliente'),cp.node,h('label',null,'Motivo de la cita'),mot,bi,bt,bo,
    h('label',null,'Usuario que atiende'),sr,h('label',null,'Notas'),notas,
    h('label',{class:'ck'},av,'El cliente autoriza que le enviemos un recordatorio por WhatsApp 30 minutos antes'));
  modal(ed?'Editar cita':'Nueva cita',body,[{label:'Cancelar',fn:x=>x()},{label:'Guardar',cls:'pri',fn:async close=>{
    if(!fecha.value||!hora.value)return toast('Indica día y hora.');
    if(mot.value==='mostrar'&&!sInm.value)return toast('Selecciona el inmueble.');
    if(mot.value==='tramite'&&!tram.value.trim())return toast('Describe el trámite.');
    const igual=ed&&c.fecha===fecha.value&&c.hora===hora.value;
    const data={fecha:fecha.value,hora:hora.value,motivo:mot.value,inmuebleId:mot.value==='mostrar'?sInm.value:'',tramite:mot.value==='tramite'?tram.value.trim():'',
      oficinaTipo:mot.value==='oficina'?ofi.value:'',notas:notas.value.trim(),usuarioId:sr.value,avisoCliente:av.checked,
      recCliente:igual?!!c.recCliente:false,recUsuario:igual?!!c.recUsuario:false};
    const guardar=async()=>{const ok=await run(async()=>{const cid=await cp.get();if(!cid)throw new Error('Selecciona o captura al cliente (nombre y teléfono).');
      data.clienteId=cid;await db.collection('citas').doc(ed?c.id:undefined).set(data)});if(ok){close();toast('Cita guardada.')}};
    const cf=conflictos(data,ed?c.id:null);
    if(cf.length)modal('Aviso de agenda',h('div',null,cf.map(x=>h('div',{class:'warnbox'},conflTxt(x)))),
      [{label:'Cambiar hora',fn:x=>x()},{label:'Guardar de todos modos',cls:'pri',fn:async x=>{x();await guardar()}}]);
    else await guardar()}}])}

function vInm(){
  const w=h('div'),list=h('div');
  const draw=()=>{list.replaceChildren();const q=S.qInm.toLowerCase();
    const l=S.inmuebles.filter(i=>(S.fInm==='todos'||i.estado===S.fInm)&&((i.ubicacion||'')+(i.caracteristicas||'')+((cli(i.propietarioId)||{}).nombre||'')).toLowerCase().includes(q));
    if(!l.length)list.append(h('p',{class:'muted'},'Sin inmuebles.'));
    l.forEach(i=>{const p=cli(i.propietarioId);
      list.append(h('div',{class:'card'},h('div',{class:'bd'},h('h4',null,i.ubicacion),h('div',null,i.caracteristicas),
        h('div',{class:'muted'},'Propietario: '+(p?p.nombre+' · '+p.telefono:'—')),
        h('span',{class:'tag '+(i.estado==='vendido'?'bad':'ok')},i.estado==='vendido'?'Vendido':'Disponible')),
        h('div',{class:'ac'},h('button',{class:'btn sm',onclick:()=>run(()=>db.doc('inmuebles/'+i.id).update({estado:i.estado==='vendido'?'disponible':'vendido'}))},i.estado==='vendido'?'Marcar disponible':'Marcar vendido'),
          h('button',{class:'btn sm',onclick:()=>inmForm(i)},'Editar'),
          h('button',{class:'btn sm bad',onclick:()=>{if(S.citas.some(c=>c.inmuebleId===i.id))return toast('Tiene citas asociadas.');confirmar('¿Eliminar este inmueble?','Eliminar',()=>run(()=>db.doc('inmuebles/'+i.id).delete()))}},'Eliminar'))))})};
  const fs=h('select',{onchange:e=>{S.fInm=e.target.value;draw()}},[['todos','Todos'],['disponible','Disponibles'],['vendido','Vendidos']].map(([v,l])=>h('option',{value:v},l)));fs.value=S.fInm;
  w.append(h('div',{class:'bar'},h('input',{placeholder:'Buscar…',value:S.qInm,oninput:e=>{S.qInm=e.target.value;draw()}}),fs,h('span',{class:'grow'}),h('button',{class:'btn pri',onclick:()=>inmForm()},'+ Nuevo inmueble')),list);
  draw();return w}

function inmForm(i0){
  const i=i0||{estado:'disponible'};
  const ub=h('input',{value:i.ubicacion||'',placeholder:'Calle, colonia, ciudad'}),ca=h('textarea',{placeholder:'Terreno, construcción, recámaras, baños, precio…'},i.caracteristicas||'');
  const cp=clientePicker(i.propietarioId);const es=h('select',null,h('option',{value:'disponible'},'Disponible'),h('option',{value:'vendido'},'Vendido'));es.value=i.estado||'disponible';
  modal(i0?'Editar inmueble':'Nuevo inmueble',h('div',null,h('label',null,'Ubicación'),ub,h('label',null,'Características'),ca,h('label',null,'Propietario'),cp.node,h('label',null,'Estado actual'),es),
    [{label:'Cancelar',fn:x=>x()},{label:'Guardar',cls:'pri',fn:async close=>{
      if(!ub.value.trim())return toast('Indica la ubicación.');
      const ok=await run(async()=>{const pid=await cp.get();if(!pid)throw new Error('Selecciona o captura al propietario.');
        await db.collection('inmuebles').doc(i0?i0.id:undefined).set({ubicacion:ub.value.trim(),caracteristicas:ca.value.trim(),propietarioId:pid,estado:es.value})});
      if(ok)close()}}])}

function vCli(){
  const w=h('div'),list=h('div');
  const draw=()=>{list.replaceChildren();const q=S.qCli.toLowerCase();
    const l=[...S.clientes].sort(byName).filter(c=>((c.nombre||'')+(c.telefono||'')).toLowerCase().includes(q));
    if(!l.length)list.append(h('p',{class:'muted'},'Sin clientes.'));
    l.forEach(c=>{const props=S.inmuebles.filter(i=>i.propietarioId===c.id);
      list.append(h('div',{class:'card'},h('div',{class:'bd'},h('h4',null,c.nombre),h('div',{class:'muted'},c.telefono),
        props.length?h('span',{class:'tag'},'Propietario de: '+props.map(p=>p.ubicacion).join(' | ')):null),
        h('div',{class:'ac'},h('button',{class:'btn sm',onclick:()=>cliForm(c)},'Editar'),
          h('button',{class:'btn sm bad',onclick:()=>{if(props.length||S.citas.some(x=>x.clienteId===c.id))return toast('Tiene inmuebles o citas asociadas.');confirmar('¿Eliminar este cliente?','Eliminar',()=>run(()=>db.doc('clientes/'+c.id).delete()))}},'Eliminar'))))})};
  w.append(h('div',{class:'bar'},h('input',{placeholder:'Buscar…',value:S.qCli,oninput:e=>{S.qCli=e.target.value;draw()}}),h('span',{class:'grow'}),h('button',{class:'btn pri',onclick:()=>cliForm()},'+ Nuevo cliente')),list);
  draw();return w}

function cliForm(c0){
  const n=h('input',{value:c0?c0.nombre:''}),t=h('input',{type:'tel',value:c0?c0.telefono:''});
  modal(c0?'Editar cliente':'Nuevo cliente',h('div',null,h('label',null,'Nombre'),n,h('label',null,'Teléfono'),t),
    [{label:'Cancelar',fn:x=>x()},{label:'Guardar',cls:'pri',fn:async close=>{
      if(!n.value.trim()||!t.value.trim())return toast('Nombre y teléfono son obligatorios.');
      if(await run(()=>db.collection('clientes').doc(c0?c0.id:undefined).set({nombre:n.value.trim(),telefono:t.value.trim()})))close()}}])}

function vRec(){
  const w=h('div'),l=recordatorios();
  w.append(h('p',{class:'muted'},'Cliente: 30 min antes (solo si autorizó). Usuario: 1 hora antes. El mensaje se abre en WhatsApp listo para enviar; mantén la app abierta para recibir los avisos a tiempo.'));
  if(!l.length)w.append(h('p',{class:'muted'},'No hay recordatorios en las próximas 24 horas.'));
  l.forEach(r=>{const k=cli(r.c.clienteId);
    w.append(h('div',{class:'card'},h('div',{class:'hr'},r.c.hora),
      h('div',{class:'bd'},h('h4',null,(r.tipo==='cliente'?'Cliente: ':'Usuario: ')+r.para),h('div',{class:'muted'},r.c.fecha+' · '+(k?k.nombre:'')+' · '+motivoTxt(r.c)),h('div',null,r.txt),
        h('span',{class:'tag '+(r.due?'bad':'')},r.due?'Enviar ahora':'Se habilita '+r.min+' min antes')),
      h('div',{class:'ac'},r.due&&r.link?h('a',{class:'btn wa',href:r.link,target:'_blank',rel:'noopener',onclick:()=>{run(()=>db.doc('citas/'+r.c.id).update({[r.campo]:true}))}},'Enviar por WhatsApp'):null,
        r.due?h('button',{class:'btn sm',onclick:()=>run(()=>db.doc('citas/'+r.c.id).update({[r.campo]:true}))},'Marcar enviado'):null)))});
  return w}

function vUsu(){
  const w=h('div');
  w.append(h('p',{class:'muted'},'Quien inicia sesión por primera vez queda como "pendiente". Solo tú decides quién tiene acceso.'));
  const orden={pendiente:0,activo:1,bloqueado:2};
  const l=[...S.usuarios].sort((a,b)=>((orden[a.estado]??3)-(orden[b.estado]??3))||byName(a,b));
  l.forEach(u=>{const yo=u.id===S.uid;
    w.append(h('div',{class:'card'},h('div',{class:'bd'},h('h4',null,(u.nombre||'Usuario')+(yo?' (tú)':'')),h('div',{class:'muted'},u.email||''),h('div',{class:'muted'},'WhatsApp: '+(u.telefono||'—')),
      h('span',{class:'tag'},u.rol||'Agente'),h('span',{class:'tag '+(u.estado==='activo'?'ok':u.estado==='pendiente'?'warn':'bad')},u.estado==='activo'?'Activo':u.estado==='pendiente'?'Pendiente de autorizar':'Bloqueado')),
      h('div',{class:'ac'},
        u.estado!=='activo'?h('button',{class:'btn sm pri',onclick:()=>run(()=>db.doc('usuarios/'+u.id).update({estado:'activo'}))},'Autorizar'):null,
        u.estado==='activo'&&!yo?h('button',{class:'btn sm bad',onclick:()=>run(()=>db.doc('usuarios/'+u.id).update({estado:'bloqueado'}))},'Bloquear'):null,
        h('button',{class:'btn sm',onclick:()=>usuForm(u,yo)},'Editar'),
        !yo?h('button',{class:'btn sm bad',onclick:()=>confirmar('¿Eliminar este usuario? Si vuelve a entrar quedará pendiente.','Eliminar',()=>run(()=>db.doc('usuarios/'+u.id).delete()))},'Eliminar'):null)))});
  return w}

function usuForm(u,yo){
  const n=h('input',{value:u.nombre||''}),t=h('input',{type:'tel',value:u.telefono||'',placeholder:'10 dígitos'});
  const rol=h('select',null,h('option',{value:'Agente'},'Agente'),h('option',{value:'Administrador'},'Administrador'));rol.value=u.rol||'Agente';rol.disabled=yo;
  modal('Editar usuario',h('div',null,h('label',null,'Nombre'),n,h('label',null,'Teléfono WhatsApp (recordatorios)'),t,h('label',null,'Rol'),rol),
    [{label:'Cancelar',fn:x=>x()},{label:'Guardar',cls:'pri',fn:async c=>{
      if(await run(()=>db.doc('usuarios/'+u.id).update({nombre:n.value.trim()||u.nombre,telefono:t.value.trim(),rol:rol.value})))c()}}])}

/* ---------- arranque ---------- */
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;render()});
window.addEventListener('appinstalled',()=>{installEv=null;render()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
setInterval(()=>{notificar();const n=recordatorios().filter(r=>r.due).length;
  if(S.access&&(n!==lastCount||S.tab==='recordatorios')&&!document.querySelector('.ov'))render()},20000);
render();
