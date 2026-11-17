const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../world10-pro.js'),'utf8');

function makePage(entries){
  const host='https://driver.digiylyfe.com';
  const nodes=entries.map(e=>{
    const parent={
      kind:e.kind||'ui',
      closest(selector){
        if(this.kind==='driver' && selector==='#title')return {};
        if(this.kind==='rate' && selector.includes('#ratesListOwner .trip strong'))return {};
        if(this.kind==='input' && selector.includes('input,textarea'))return {};
        return null;
      }
    };
    return {nodeValue:e.text,parentElement:parent};
  });
  const input={
    attrs:{placeholder:'Ex : Saly, Mbour, AIBD, Petite Côte'},
    getAttribute(k){return this.attrs[k]||null},
    setAttribute(k,v){this.attrs[k]=v},
    closest(){return null}
  };
  const rateTemplate={
    dataset:{label:'Course locale'},attrs:{},
    getAttribute(k){return this.attrs[k]||null},
    setAttribute(k,v){this.attrs[k]=v},
    closest(){return null}
  };
  const link={
    value:'./chauffeur.html?slug=lamine-driver-saly',
    getAttribute(k){return k==='href'?this.value:null},
    setAttribute(k,v){if(k==='href')this.value=v}
  };
  const network={readOnly:true,value:'Activé'};
  let picker=null;
  const header={
    style:{},
    appendChild(element){picker=element;return element}
  };
  const document={
    readyState:'complete',title:'Gestion DRIVER — DIGIYLYFE',
    documentElement:{lang:'fr',dir:'ltr'},body:{},
    querySelector(sel){return sel==='header.top'?header:null},
    getElementById(id){if(id==='network')return network;return id==='driverWorld10Pro'?picker:null},
    querySelectorAll(sel){
      if(sel==='a[href]')return [link];
      if(sel==='[placeholder]')return [input];
      if(sel==='[aria-label]')return [picker].filter(Boolean);
      return [];
    },
    createTreeWalker(){
      let i=-1;
      return {
        currentNode:null,
        nextNode(){i++;if(i>=nodes.length)return false;this.currentNode=nodes[i];return true}
      };
    },
    createElement(tag){
      return {
        tagName:tag,children:[],style:{},attrs:{},
        value:'',
        appendChild(el){this.children.push(el);return el},
        getAttribute(k){return this.attrs[k]||null},
        setAttribute(k,v){this.attrs[k]=v},
        closest(){return null},addEventListener(){}
      };
    }
  };
  const values=new Map();
  const sandbox={
    document,URL,URLSearchParams,NodeFilter:{SHOW_TEXT:4},
    location:{href:host+'/gestion.html?slug=lamine-driver-saly',
      origin:host,pathname:'/gestion.html',search:'?slug=lamine-driver-saly',hash:''},
    history:{replaceState(){}},
    localStorage:{getItem(k){return values.get(k)||null},setItem(k,v){values.set(k,v)}},
    MutationObserver:class{observe(){}}
  };
  sandbox.window=sandbox;
  vm.runInNewContext(source,sandbox,{timeout:3000});
  return {api:sandbox.DIGIY_DRIVER_WORLD10,nodes,document,network,link,picker,input,rateTemplate,values};
}

test('driver owner really supports FR EN AR WO ZH without touching own vehicle or price data',()=>{
  const page=makePage([
    {text:'Présence chauffeur'},
    {text:'Mes courses, extras & prix'},
    {text:'Course locale',kind:'rate'},
    {text:'🚗 Lamine · MASTER',kind:'driver'},
    {text:'Connecté : lamine@example.com'},
    {text:'Aucun trajet tarifé pour le moment.'},
    {text:'Course locale'},
    {text:'✅ Prix retiré.'}
  ]);
  assert.equal(page.api.locales.length,10);
  assert.equal(page.picker.children.length,10);
  page.api.setLang('en');
  assert.equal(page.nodes[0].nodeValue,'Driver availability');
  assert.equal(page.nodes[1].nodeValue,'My routes, extras & prices');
  assert.equal(page.nodes[2].nodeValue,'Course locale','Owner rate name must never be translated');
  assert.equal(page.nodes[3].nodeValue,'🚗 Lamine · MASTER','Authenticated owner identity must never change');
  assert.equal(page.nodes[4].nodeValue,'Signed in: lamine@example.com');
  assert.equal(page.nodes[5].nodeValue,'No priced routes yet.');
  assert.equal(page.nodes[6].nodeValue,'Local ride','UI preset can translate without changing its original value');
  assert.equal(page.nodes[7].nodeValue,'✅ Price removed.');
  assert.equal(page.network.value,'Enabled');
  assert.equal(page.input.attrs.placeholder,'E.g. Saly, Mbour, AIBD, Petite Côte');
  assert.equal(new URL(page.link.value).searchParams.get('slug'),'lamine-driver-saly');
  assert.equal(new URL(page.link.value).searchParams.get('lang'),'en');
  assert.equal(page.rateTemplate.dataset.label,'Course locale');
  page.api.setLang('ar');
  assert.equal(page.document.documentElement.dir,'rtl');
  assert.match(page.nodes[0].nodeValue,/[\u0600-\u06FF]/);
  assert.equal(page.nodes[2].nodeValue,'Course locale');
  assert.equal(page.network.value,'مفعّل');
  page.api.setLang('wo');
  assert.equal(page.nodes[0].nodeValue,'Feeñu dawalkat');
  page.api.setLang('zh');
  assert.match(page.nodes[0].nodeValue,/[\u4e00-\u9fff]/);
  page.api.setLang('fr');
  assert.equal(page.nodes[0].nodeValue,'Présence chauffeur');
  assert.equal(page.network.value,'Activé');
});

test('dynamic errors and save confirmations translate but leave service-owned errors intact',()=>{
  const page=makePage([
    {text:'⚠️ Profil enregistré, détails non enregistrés : erreur réseau'},
    {text:'✅ Profil public, véhicule, photos et WhatsApp mis à jour.'}
  ]);
  page.api.setLang('es');
  assert.match(page.nodes[0].nodeValue,/Perfil guardado, detalles no guardados: erreur réseau/);
  assert.equal(page.nodes[1].nodeValue,'✅ Perfil público, vehículo, fotos y WhatsApp actualizados.');
  page.nodes.push({nodeValue:'✅ Trajet et prix enregistrés.',parentElement:{closest(){return null}}});
  page.api.translatePage();
  assert.equal(page.nodes[2].nodeValue,'✅ Trayecto y precio guardados.');
});
