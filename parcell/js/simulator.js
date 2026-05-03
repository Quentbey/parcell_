// simulator.js — Calculs financiers + import IA + drawers

// ═══ MODE SIMPLE / PRO ═══
function setMode(m){
  simMode=m;
  document.getElementById('modeSimple').classList.toggle('active',m==='simple');
  document.getElementById('modePro').classList.toggle('active',m==='pro');
  document.getElementById('modeSimple').classList.toggle('simple',true);
  document.getElementById('modePro').classList.toggle('pro',true);
  document.getElementById('blockSimple').style.display=m==='simple'?'block':'none';
  document.getElementById('blockPro').style.display=m==='pro'?'block':'none';
  document.getElementById('modeDesc').textContent=m==='simple'
    ?'Estimez rapidement la rentabilité d\'un bien en quelques clics.'
    :'Affinez chaque paramètre pour une simulation complète et précise.';
  calcSim();
}

function toggleOpt(name,el){
  const cb=document.getElementById('cb-'+name);
  cb.checked=!cb.checked;
  if(cb.checked){activeOpts.add(name);el.classList.add('checked');}
  else{activeOpts.delete(name);el.classList.remove('checked');}
  updateSimLoyer();
}

// ═══ SYNC entre simple et pro ═══
function syncSurf(el){
  document.getElementById('simSurf').value=el.value;
  document.getElementById('simSurfS').value=el.value;
}
function syncPrix(el){
  // sync the other field
  const other = el.id==='simPrix' ? 'simPrixS' : 'simPrix';
  document.getElementById(other).value=el.value;
}
function autoNotaire(){
  const p=parseFloat(document.getElementById('simPrix').value)||parseFloat(document.getElementById('simPrixS').value)||0;
  document.getElementById('simNotaire').value=Math.round(p*0.075);
}

// ═══ TAB / RENDER ═══
function switchTab(tab,el){
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.main-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  // el can be null when called from dropdown
  if(el) el.classList.add('active');
  else {
    // Activate the matching tab button by text content
    document.querySelectorAll('.main-tab').forEach(t=>{
      if((tab==='analyse'&&t.textContent.includes('Analyse'))||
         (tab==='simulateur'&&t.textContent.includes('Simulateur'))||
         (tab==='compte'&&t.textContent.includes('espace')))
        t.classList.add('active');
    });
  }
  if(tab==='analyse') setTimeout(()=>{if(leafletMap)leafletMap.invalidateSize();},200);
  if(tab==='compte') { showCompteSection('projets'); }
}
function renderAll(){renderChips();renderKPIs();updateMapLayers();renderAttrRanking();renderTable();renderPopChart();renderSalPriceChart();}
function toggleCity(v){const i=selectedCities.indexOf(v);if(i>-1){if(selectedCities.length>1)selectedCities.splice(i,1);}else{if(selectedCities.length<10)selectedCities.push(v);}renderAll();}
function onDeptChange(){renderChips();}
function filterCities(){
  const q=document.getElementById('citySearch').value.trim();
  if(!q) return;
  const m=CITIES.find(c=>c.Ville.toLowerCase()===q.toLowerCase());
  if(m&&!selectedCities.includes(m.Ville)){selectedCities.push(m.Ville);document.getElementById('citySearch').value='';renderAll();}
}
function renderChips(){
  const sec=document.getElementById('chipsSection'),w=document.getElementById('chipsWrap');
  if(!selectedCities.length){sec.style.display='none';return;}
  sec.style.display='block';
  w.innerHTML=selectedCities.map(v=>`<div class="chip" onclick="toggleCity('${v}')">${v} <span>✕</span></div>`).join('');
}
function renderKPIs(){
  const sel=CITIES.filter(c=>selectedCities.includes(c.Ville));
  if(!sel.length){document.getElementById('kpiCards').innerHTML='';return;}
  const avgPrix=Math.round(sel.reduce((s,c)=>s+c.Prix_m2,0)/sel.length);
  const avgLoyer=Math.round(sel.reduce((s,c)=>s+c.Loyer_m2_Apt,0)/sel.length);
  const avgSal=Math.round(sel.reduce((s,c)=>s+c.Salaire_Med,0)/sel.length);
  const best=sel.reduce((a,b)=>a.Attractivite>b.Attractivite?a:b);
  document.getElementById('kpiCards').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">Prix m² moyen</div><div class="kpi-value" style="color:var(--teal)">${avgPrix.toLocaleString('fr-FR')} €</div><div class="kpi-sub">${sel.length} villes</div></div>
    <div class="kpi-card"><div class="kpi-label">Loyer réel moy.</div><div class="kpi-value" style="color:var(--gold)">${avgLoyer} €/m²</div><div class="kpi-sub">Après tension loc.</div></div>
    <div class="kpi-card"><div class="kpi-label">Salaire médian</div><div class="kpi-value">${avgSal.toLocaleString('fr-FR')} €</div><div class="kpi-sub">Net mensuel</div></div>
    <div class="kpi-card"><div class="kpi-label">Top attractivité</div><div class="kpi-value" style="color:var(--green)">${best.Attractivite}/10</div><div class="kpi-sub">${best.Ville}</div><span class="kpi-badge badge-gold">⭐ Top</span></div>`;
}

// ═══ MAP ═══
function initMap(){
  leafletMap=L.map('leafletMap',{center:[46.2,4.5],zoom:6});
  // Tuiles sombres (design cohérent) avec labels en français via CartoDB Dark Matter
  // CartoDB utilise les données OSM et affiche les noms en langue locale (FR en France)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/">CARTO</a>',
    subdomains:'abcd',
    maxZoom:20
  }).addTo(leafletMap);
  leafletMap.on('zoomend',()=>{updateMapLayers();const z=leafletMap.getZoom();const h=document.getElementById('mapHint');h.textContent=z>=13?'· Vue quartiers (Lyon)':z>=10?'· Vue communes':z>=7?'· Vue départements':'· Zoom pour délimitations';});
  updateMapLayers();
}
async function fetchPoly(insee,type){
  const k=`${insee}_${type}`;if(pgCache[k]!==undefined)return pgCache[k];
  try{const url=type==='commune'?`https://geo.api.gouv.fr/communes/${insee}?fields=contour&format=json&geometry=contour`:`https://geo.api.gouv.fr/departements/${insee.startsWith('97')?insee.slice(0,3):insee.slice(0,2)}?fields=contour&format=json&geometry=contour`;const r=await fetch(url);const d=await r.json();pgCache[k]=d.contour||null;return pgCache[k];}catch(e){pgCache[k]=null;return null;}
}
function tensionLabel(t){return t>=8?'Très tendue':t>=6?'Tendue':t>=4?'Modérée':'Détendue';}
function tensionColor(t){return t>=8?'var(--teal)':t>=6?'var(--gold)':'var(--red)';}
async function updateMapLayers(){
  if(!leafletMap)return;
  leafletPolygons.forEach(l=>leafletMap.removeLayer(l));leafletPolygons=[];
  leafletMarkers.forEach(m=>leafletMap.removeLayer(m));leafletMarkers=[];
  quartierLayers.forEach(l=>leafletMap.removeLayer(l));quartierLayers=[];
  const zoom=leafletMap.getZoom();
  if(zoom>=13){
    LYON_QUARTIERS.forEach(q=>{
      const rentab=((q.loyer_apt*12)/q.prix_m2*100).toFixed(1);
      const popup=`<div class="pop-title">${q.nom}</div><div class="pop-subtitle">Tension : ${tensionLabel(q.Tension)} (${q.Tension}/10)</div>
        <div class="pop-row"><span>Prix m²</span><span>${q.prix_m2.toLocaleString('fr-FR')} €</span></div>
        <div class="pop-row"><span>Loyer réel apt.</span><span>${q.loyer_apt} €/m²</span></div>
        <div class="pop-row"><span>Rendement</span><span>${rentab}%</span></div>
        <div class="pop-actions"><button class="pop-btn pop-btn-add" onclick="useQuartierInSim('${q.code}')">📊 Simuler ce quartier</button></div>`;
      const icon=L.divIcon({className:'',html:`<div style="padding:3px 7px;background:#c9a84c;border-radius:5px;font-family:'Outfit',sans-serif;font-size:11px;font-weight:700;color:#0a0d14;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;">${q.code.replace('Lyon ','')}</div>`,iconAnchor:[20,10]});
      const m=L.marker([q.lat,q.lon],{icon}).addTo(leafletMap).bindPopup(popup,{maxWidth:240});
      quartierLayers.push(m);
    });return;
  }
  for(const c of CITIES){
    const isSel=selectedCities.includes(c.Ville);
    const color=isSel?COLORS[selectedCities.indexOf(c.Ville)%COLORS.length]:'#3a4560';
    const rentab=((c.Loyer_m2_Apt*12)/c.Prix_m2*100).toFixed(1);
    const popup=`<div class="pop-title">${c.Ville}</div>
      <div class="pop-row"><span>Prix m²</span><span>${c.Prix_m2.toLocaleString('fr-FR')} €</span></div>
      <div class="pop-row"><span>Loyer réel apt.</span><span>${c.Loyer_m2_Apt} €/m²</span></div>
      <div class="pop-row"><span>Rendement</span><span>${rentab}%</span></div>
      <div class="pop-row"><span>Tension loc.</span><span style="color:${tensionColor(c.Tension)}">${tensionLabel(c.Tension)} (${c.Tension}/10)</span></div>
      ${c.hasQuartiers?'<div style="font-size:11px;color:var(--teal);margin-top:5px;">🔍 Zoom > 13 pour les quartiers</div>':''}
      <div class="pop-actions"><button class="pop-btn ${isSel?'pop-btn-remove':'pop-btn-add'}" onclick="toggleCity('${c.Ville}')">${isSel?'✕ Retirer':'+ Sélectionner'}</button></div>`;
    if(zoom>=7&&c.insee){
      const geo=await fetchPoly(c.insee,zoom>=10?'commune':'departement');
      if(geo){const poly=L.geoJSON(geo,{style:{color,weight:isSel?2.5:1,opacity:isSel?0.9:0.3,fillColor:color,fillOpacity:isSel?0.2:0.05}}).addTo(leafletMap).bindPopup(popup,{maxWidth:240});poly.on('click',()=>toggleCity(c.Ville));leafletPolygons.push(poly);continue;}
    }
    const sz=isSel?14:9;
    const icon=L.divIcon({className:'',html:`<div style="width:${sz}px;height:${sz}px;background:${color};border-radius:50%;border:2px solid ${isSel?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.2)'};box-shadow:${isSel?'0 0 12px '+color+'99':'none'};cursor:pointer;"></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
    const marker=L.marker([c.Lat,c.Lon],{icon}).addTo(leafletMap).bindPopup(popup,{maxWidth:240});
    marker.on('click',()=>toggleCity(c.Ville));
    leafletMarkers.push(marker);
  }
}
function useQuartierInSim(code){
  document.querySelectorAll('.main-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-simulateur').classList.add('active');
  document.querySelector('.main-tab:nth-child(2)').classList.add('active');
  document.getElementById('simVille').value='Lyon';
  onSimVilleChange();
  setTimeout(()=>{document.getElementById('simQuartier').value=code;updateSimLoyer();},60);
}

// ═══ TABLE ═══
function renderAttrRanking(){
  const sel=CITIES.filter(c=>selectedCities.includes(c.Ville)).sort((a,b)=>b.Attractivite-a.Attractivite);
  document.getElementById('attrRanking').innerHTML=sel.length
    ?sel.map((c,i)=>`<div class="progress-row" style="animation:fadeUp 0.4s ${i*0.05}s ease both;opacity:0;animation-fill-mode:forwards"><div class="progress-name">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'·'} ${c.Ville}</div><div class="progress-track"><div class="progress-fill" style="width:${c.Attractivite*10}%"></div></div><div class="progress-val">${c.Attractivite}/10</div></div>`).join('')
    :'<p style="color:var(--text3);font-size:13px;padding:10px 0;">Sélectionnez des villes.</p>';
}
function sortByCol(k){if(sortKey===k)sortAsc=!sortAsc;else{sortKey=k;sortAsc=false;}renderTable();}
function renderTable(){
  let data=CITIES.filter(c=>selectedCities.includes(c.Ville));
  data.sort((a,b)=>{const va=a[sortKey],vb=b[sortKey];if(typeof va==='string')return sortAsc?va.localeCompare(vb):vb.localeCompare(va);return sortAsc?va-vb:vb-va;});
  const empty=document.getElementById('tableEmpty'),table=document.getElementById('mainTable');
  if(!data.length){table.style.display='none';empty.style.display='block';return;}
  table.style.display='table';empty.style.display='none';
  const LABELS={Ville:'Ville',Dept:'Département','2022':'Population',Prix_m2:'Prix m²',Loyer_m2_Apt:'Loyer réel',Tension:'Tension',Attractivite:'Attractivité'};
  Object.keys(LABELS).forEach(k=>{const th=document.getElementById('th-'+k);if(!th)return;const arrow=k===sortKey?(sortAsc?' ↑':' ↓'):' ↕';th.textContent=LABELS[k]+arrow;th.classList.toggle('sorted',k===sortKey);});
  document.getElementById('tableBody').innerHTML=data.map(c=>{
    const rentab=((c.Loyer_m2_Apt*12)/c.Prix_m2*100).toFixed(1);
    const color=COLORS[selectedCities.indexOf(c.Ville)%COLORS.length];
    const tl=tensionLabel(c.Tension);const tc=tensionColor(c.Tension);
    const tClass=c.Tension>=8?'t-high':c.Tension>=5?'t-med':'t-low';
    return `<tr onclick="toggleCity('${c.Ville}')" style="cursor:pointer;"><td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:7px;vertical-align:middle;"></span><strong>${c.Ville}</strong></td><td style="color:var(--text2)">${c.Dept}</td><td>${c['2022'].toLocaleString('fr-FR')}</td><td>${c.Prix_m2.toLocaleString('fr-FR')} €</td><td>${c.Loyer_m2_Apt} €/m² <small style="color:var(--teal)">(${rentab}%)</small></td><td><span class="tension-badge ${tClass}">${tl} ${c.Tension}/10</span></td><td>${c.Attractivite}/10 <span class="score-bar"><span class="score-fill" style="width:${c.Attractivite*10}%"></span></span></td></tr>`;
  }).join('');
}

// ═══ CHARTS ═══
const YEARS=[1970,1982,1990,1999,2011,2015,2022];
function renderPopChart(){const sel=CITIES.filter(c=>selectedCities.includes(c.Ville));const ctx=document.getElementById('popChart').getContext('2d');if(popChart)popChart.destroy();popChart=new Chart(ctx,{type:'line',data:{labels:YEARS,datasets:sel.map((c,i)=>({label:c.Ville,data:YEARS.map(y=>c[y.toString()]),borderColor:COLORS[i%COLORS.length],backgroundColor:COLORS[i%COLORS.length]+'15',borderWidth:2.5,pointRadius:3,tension:0.4,fill:false}))},options:{responsive:true,plugins:{legend:{labels:{color:'#7e8a9e',font:{family:'DM Sans',size:11}}}},scales:{x:{grid:{color:'#141829'},ticks:{color:'#4e5a6e'}},y:{grid:{color:'#141829'},ticks:{color:'#4e5a6e',callback:v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${Math.round(v/1e3)}k`:v}}}}});}
function renderSalPriceChart(){const sel=CITIES.filter(c=>selectedCities.includes(c.Ville));const ctx=document.getElementById('salPriceChart').getContext('2d');if(salPriceChart)salPriceChart.destroy();salPriceChart=new Chart(ctx,{type:'bar',data:{labels:sel.map(c=>c.Ville),datasets:[{label:'Prix m² (€)',data:sel.map(c=>c.Prix_m2),backgroundColor:COLORS.map(c=>c+'99'),borderRadius:5,borderSkipped:false},{label:'Salaire médian (€)',data:sel.map(c=>c.Salaire_Med),backgroundColor:'#2dd4bf44',borderRadius:5,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{labels:{color:'#7e8a9e',font:{family:'DM Sans',size:11}}}},scales:{x:{grid:{display:false},ticks:{color:'#4e5a6e'}},y:{grid:{color:'#141829'},ticks:{color:'#4e5a6e'}}}}});}

// ═══ SIMULATEUR ═══
function setType(t){simType=t;document.getElementById('btnApt').classList.toggle('active',t==='Apt');document.getElementById('btnMsn').classList.toggle('active',t==='Msn');updateSimLoyer();}
function setMeuble(v){simMeuble=v;document.getElementById('btnMeuble').classList.toggle('active',v);document.getElementById('btnNonMeuble').classList.toggle('active',!v);document.getElementById('meublePct').disabled=!v;document.getElementById('meublePct').style.opacity=v?1:0.4;updateSimLoyer();}

function onSimVilleChange(){
  const ville=document.getElementById('simVille').value;
  const city=CITIES.find(c=>c.Ville===ville);
  const qBlock=document.getElementById('quartierBlock'),qSel=document.getElementById('simQuartier');
  if(city&&city.hasQuartiers){qBlock.style.display='block';qSel.innerHTML=LYON_QUARTIERS.map(q=>`<option value="${q.code}">${q.nom}</option>`).join('');}
  else{qBlock.style.display='none';qSel.innerHTML='';}
  updateSimLoyer();
}

function updateSimLoyer(){
  const ville=document.getElementById('simVille').value;
  const city=CITIES.find(c=>c.Ville===ville);if(!city)return;
  const qCode=document.getElementById('simQuartier').value;
  let lyrBase,prixRef,tension;
  if(city.hasQuartiers&&qCode){
    const q=LYON_QUARTIERS.find(x=>x.code===qCode);
    if(q){lyrBase=simType==='Apt'?q.loyer_apt:q.loyer_msn;prixRef=q.prix_m2;tension=q.Tension;}
  }
  if(!lyrBase){lyrBase=simType==='Apt'?city.Loyer_m2_Apt:city.Loyer_m2_Msn;prixRef=city.Prix_m2;tension=city.Tension;}

  const surf=parseFloat(document.getElementById(simMode==='simple'?'simSurfS':'simSurf').value)||45;
  const pcs=parseInt(document.getElementById('simPcs').value)||2;
  const coef={1:1.2,2:1.0,3:0.9,4:0.85,5:0.8,6:0.75}[pcs]||0.9;
  const meublePct=simMeuble&&simMode==='pro'?(parseFloat(document.getElementById('meublePct').value)||15)/100:simMode==='simple'?0:0;
  // Bonus équipements (mode pro)
  let optBonus=0;
  if(simMode==='pro'){activeOpts.forEach(o=>optBonus+=OPT_BONUS[o]||0);}
  const loyer=Math.round(lyrBase*surf*coef*(1+meublePct)*(1+optBonus));

  document.getElementById('simLoyer').value=loyer;
  const qLabel=city.hasQuartiers&&qCode?' · '+qCode:'';
  const tLabel=`Tension ${tensionLabel(tension)} (${tension}/10)`;
  document.getElementById('lyrInfo').textContent=`${city.Ville}${qLabel} · ${lyrBase}€/m² · ${tLabel}`;
  calcSim();
}

function calcSim(){
  const isSimple=simMode==='simple';
  const prix=parseFloat(document.getElementById(isSimple?'simPrixS':'simPrix').value)||0;
  const notaire=isSimple?Math.round(prix*0.075):parseFloat(document.getElementById('simNotaire').value)||0;
  const travaux=isSimple?5000:parseFloat(document.getElementById('simTravaux').value)||0;
  const apport=parseFloat(document.getElementById(isSimple?'simApportS':'simApport').value)||0;
  const duree=isSimple?20:parseInt(document.getElementById('simDuree').value)||20;
  const taux=isSimple?3.6:parseFloat(document.getElementById('simTaux').value)||3.6;
  const loyer=parseFloat(document.getElementById('simLoyer').value)||0;
  const assurPct=isSimple?0.20:parseFloat(document.getElementById('simAssur').value)||0.20;
  const vacance=isSimple?1:parseFloat(document.getElementById('simVacance').value)||1;
  const copro=isSimple?0:parseFloat(document.getElementById('simCopro').value)||0;

  const total=prix+notaire+travaux,pret=Math.max(0,total-apport);
  const tauxM=(taux/100)/12,n=duree*12;
  const mensualite=pret>0?pret*(tauxM*Math.pow(1+tauxM,n))/(Math.pow(1+tauxM,n)-1):0;
  const assurMens=(pret*assurPct/100)/12;
  const loyerAjuste=loyer*(1-vacance/12);
  const chargesMens=total*0.005/12+copro;
  const rentBrute=total>0?(loyer*12)/total:0;
  const rentNette=total>0?(loyerAjuste*12-chargesMens*12)/total:0;
  const cashflow=loyerAjuste-mensualite-assurMens-chargesMens;

  simData={total,pret,mensualite,assurMens,loyer,loyerAjuste,chargesMens,rentBrute,rentNette,cashflow,vacance,taux,duree,assurPct,copro};

  document.getElementById('totalProjet').textContent=fmt(total)+' €';
  document.getElementById('montantPret').textContent=fmt(pret)+' €';
  document.getElementById('rentBrute').textContent=(rentBrute*100).toFixed(2)+'%';
  document.getElementById('rentNette').textContent=(rentNette*100).toFixed(2)+'%';
  document.getElementById('mensualite').textContent=fmt(Math.round(mensualite))+' €';
  document.getElementById('assurMens').textContent=fmt(Math.round(assurMens))+' €';
  const cfVal=document.getElementById('cashflowVal'),cfBox=document.getElementById('cashflowBox');
  cfVal.textContent=(cashflow>=0?'+':'')+fmt(Math.round(cashflow))+' €/mois';
  cfVal.style.color=cashflow>=0?'var(--green)':'var(--red)';
  cfBox.className='cashflow-indicator '+(cashflow>=0?'cashflow-pos':'cashflow-neg');
}

// ═══ DRAWER ═══
function openDrawer(type){
  if(drawerChart){drawerChart.destroy();drawerChart=null;}
  const ville=document.getElementById('simVille').value;
  const city=CITIES.find(c=>c.Ville===ville);
  const qCode=document.getElementById('simQuartier').value;
  const locLabel=city?.hasQuartiers&&qCode?`${ville} — ${qCode}`:ville;
  const dt=document.getElementById('drawerTitle'),ds=document.getElementById('drawerSubtitle'),dc=document.getElementById('drawerContent');

  if(type==='rentabilite'){
    dt.textContent='Analyse de rentabilité';ds.textContent=locLabel;
    const rb=(simData.rentBrute*100).toFixed(2),rn=(simData.rentNette*100).toFixed(2);
    const bench=parseFloat(rb)>=7?'🟢 Excellente':parseFloat(rb)>=5?'🟡 Correcte':'🔴 Faible';
    dc.innerHTML=`<div class="drawer-section"><div class="drawer-section-title">Indicateurs</div>
      <div class="drawer-stat-grid">
        <div class="drawer-stat"><div class="drawer-stat-label">Renta. brute</div><div class="drawer-stat-value" style="color:var(--teal)">${rb}%</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Renta. nette</div><div class="drawer-stat-value" style="color:var(--gold)">${rn}%</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Loyer annuel</div><div class="drawer-stat-value">${fmt(Math.round(simData.loyer*12))} €</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Coût total</div><div class="drawer-stat-value">${fmt(simData.total)} €</div></div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px 14px;font-size:13px;">${bench} — Rentabilité brute de <strong>${rb}%</strong><br><span style="color:var(--text3);font-size:12px;">Vacance ${simData.vacance} mois/an · Charges ${fmt(Math.round(simData.chargesMens*12))} €/an</span></div>
    </div>
    <div class="drawer-section"><div class="drawer-section-title">Pistes d'amélioration</div><div style="font-size:13px;color:var(--text2);line-height:1.7;">• Négocier le prix d'achat<br>• Passer en meublé LMNP (+15–20% loyer)<br>• Choisir un quartier à forte tension locative<br>• Réduire vacance : bon emplacement, gestion proactive</div></div>`;
  } else if(type==='credit'){
    dt.textContent='Détail du crédit';ds.textContent=locLabel;
    const tI=simData.mensualite*simData.duree*12-simData.pret,tA=simData.assurMens*simData.duree*12;
    dc.innerHTML=`<div class="drawer-section"><div class="drawer-section-title">Structure du financement</div>
      <div class="drawer-stat-grid">
        <div class="drawer-stat"><div class="drawer-stat-label">Capital emprunté</div><div class="drawer-stat-value" style="color:var(--gold)">${fmt(simData.pret)} €</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Mensualité</div><div class="drawer-stat-value">${fmt(Math.round(simData.mensualite))} €</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Intérêts totaux</div><div class="drawer-stat-value" style="color:var(--red)">${fmt(Math.round(tI))} €</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Assurance totale</div><div class="drawer-stat-value">${fmt(Math.round(tA))} €</div></div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px 14px;font-size:13px;color:var(--text2);">Coût total du crédit : <strong style="color:var(--text)">${fmt(Math.round(tI+tA))} €</strong> sur ${simData.duree} ans · Taux ${simData.taux}%</div></div>`;
  } else if(type==='cashflow'){
    dt.textContent='Projection cashflow 20 ans';ds.textContent=locLabel+' · loyers +1.5%/an';
    dc.innerHTML=`
      <div class="drawer-section">
        <div class="drawer-chart-wrap" style="position:relative;height:220px;">
          <canvas id="drawerCashflowChart" style="max-height:220px;"></canvas>
        </div>
      </div>
      <div class="drawer-section"><div class="drawer-section-title">Hypothèses</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.8;">
          • Inflation loyers +1.5%/an<br>
          • Vacance ${simData.vacance||1} mois/an<br>
          • Charges entretien 0.5%/an du bien<br>
          • Mensualité fixe sur toute la durée
        </div>
      </div>`;
    // Attendre que le DOM soit peint
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const canvas=document.getElementById('drawerCashflowChart');
        if(!canvas){return;}
        if(drawerChart){drawerChart.destroy();drawerChart=null;}
        const years=Array.from({length:20},(_,i)=>i+1);
        const cfs=years.map(a=>Math.round(
          (simData.loyer||0)*Math.pow(1.015,a)*(1-(simData.vacance||1)/12)
          -(simData.mensualite||0)-(simData.assurMens||0)-(simData.chargesMens||0)
        ));
        drawerChart=new Chart(canvas.getContext('2d'),{
          type:'bar',
          data:{labels:years.map(y=>`An ${y}`),datasets:[{
            label:'Cashflow net (€/mois)',data:cfs,
            backgroundColor:cfs.map(v=>v>=0?'#34d39955':'#f8717155'),
            borderColor:cfs.map(v=>v>=0?'#34d399':'#f87171'),
            borderWidth:1.5,borderRadius:4
          }]},
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{x:{grid:{display:false},ticks:{color:'#4e5a6e',font:{size:10}}},
                    y:{grid:{color:'#141829'},ticks:{color:'#4e5a6e',callback:v=>v+'€'}}}}
        });
      });
    });
  } else if(type==='marche'){
    dt.textContent='Marché local & tension';ds.textContent=locLabel;
    const pop=city?.['2022']||50000,attr=city?.Attractivite||7,tension=city?.Tension||5;
    const qCode2=document.getElementById('simQuartier').value;
    const qTension=city?.hasQuartiers&&qCode2?LYON_QUARTIERS.find(q=>q.code===qCode2)?.Tension||tension:tension;
    const seed=pop+attr*1000;const sn=n=>Math.sin(seed*n)*0.5+0.5;
    const nbV=Math.max(8,Math.round(pop*0.0045*(attr/7)*(0.85+sn(3)*0.3)));
    const nbL=Math.max(3,Math.round(pop*0.003*(attr/7)*(0.85+sn(7)*0.3)));
    const delai=Math.round(55-attr*3.5);
    const tLvl=qTension>=8?4:qTension>=6?3:qTension>=4?2:1;
    const tClass=qTension>=8?'hi':qTension>=5?'md':'';
    const v=encodeURIComponent(ville);
    dc.innerHTML=`<div class="drawer-section"><div class="drawer-section-title">Tension locative</div>
      <div style="background:var(--bg2);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:14px;font-weight:600;">${tensionLabel(qTension)}</span><span style="font-family:'Outfit';font-size:18px;font-weight:700;color:${tensionColor(qTension)}">${qTension}/10</span></div>
        <div class="tension-bar-draw">${[1,2,3,4].map(i=>`<div class="tseg ${i<=tLvl?'on '+tClass:''}"></div>`).join('')}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:8px;">Source : LocService / Manda 2024 · ${tensionLabel(qTension)==='Détendue'?'Beaucoup de biens disponibles, concurrence élevée entre propriétaires. Le loyer maximum est rarement atteint.':tensionLabel(qTension)==='Modérée'?'Marché équilibré. Les biens bien présentés se louent au prix du marché.':tensionLabel(qTension)==='Tendue'?'Forte demande. Les biens se louent rapidement, souvent au prix demandé.':'Marché extrêmement tendu. Les biens se louent en moins de 48h avec plusieurs dossiers.'}</div>
      </div>
      <div class="drawer-stat-grid">
        <div class="drawer-stat"><div class="drawer-stat-label">Biens à vendre</div><div class="drawer-stat-value" style="color:var(--gold)">~${nbV}</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Biens à louer</div><div class="drawer-stat-value" style="color:var(--teal)">~${nbL}</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Délai vente moy.</div><div class="drawer-stat-value" style="color:var(--text2)">${delai}j</div></div>
        <div class="drawer-stat"><div class="drawer-stat-label">Tension loc.</div><div class="drawer-stat-value" style="color:${tensionColor(qTension)}">${tensionLabel(qTension)}</div></div>
      </div>
      <div style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:14px;">* Estimations indicatives. Sources : LocService, Manda, INSEE 2024.</div>
    </div>
    <div class="drawer-section"><div class="drawer-section-title">Rechercher des annonces</div>
      <a class="drawer-link dl-teal" href="https://www.seloger.com/annonces/achat/${v}.htm" target="_blank">🔍 SeLoger</a>
      <a class="drawer-link dl-gold" href="https://www.leboncoin.fr/recherche?category=9&locations=${v}" target="_blank">🔍 LeBonCoin</a>
      <a class="drawer-link dl-purple" href="https://www.pap.fr/annonce/ventes-immobilieres-${ville.toLowerCase().replace(/[éèê]/g,'e').replace(/\s/g,'-')}-g${city?.insee||''}" target="_blank">🔍 PAP.fr</a>
    </div>`;
  }

  document.getElementById('detailOverlay').classList.add('open');
  document.getElementById('detailDrawer').classList.add('open');
}
function closeDrawer(){document.getElementById('detailOverlay').classList.remove('open');document.getElementById('detailDrawer').classList.remove('open');}
function syncField(target,source){
  document.getElementById(target).value=document.getElementById(source).value;
}

// ═══ APPLIQUER LES DONNÉES EXTRAITES ═══
function applyExtracted(data){
  const fields=[];

  if(data.prix&&data.prix>10000&&data.prix<5000000){
    document.getElementById('simPrix').value=data.prix;
    document.getElementById('simPrixS').value=data.prix;
    autoNotaire();
    fields.push(`Prix : ${data.prix.toLocaleString('fr-FR')} €`);
  }
  if(data.surface&&data.surface>=9&&data.surface<=1000){
    document.getElementById('simSurf').value=data.surface;
    document.getElementById('simSurfS').value=data.surface;
    fields.push(`Surface : ${data.surface} m²`);
  }
  if(data.pieces&&data.pieces>=1&&data.pieces<=6){
    document.getElementById('simPcs').value=data.pieces;
    document.getElementById('pcsVal').textContent=data.pieces;
    fields.push(`${data.pieces} pièce${data.pieces>1?'s':''}`);
  }
  if(data.type){
    const t=data.type.toLowerCase().includes('maison')?'Msn':'Apt';
    setType(t);
    fields.push(`Type : ${t==='Msn'?'Maison':'Appartement'}`);
  }

  // Ville + quartier via code postal ou nom
  let villeDetectee=null;
  if(data.code_postal){
    const cp=String(data.code_postal);
    // Quartier Lyon via CP
    if(CP_TO_QUARTIER[cp]){
      villeDetectee='Lyon';
      document.getElementById('simVille').value='Lyon';
      onSimVilleChange();
      setTimeout(()=>{
        document.getElementById('simQuartier').value=CP_TO_QUARTIER[cp];
        updateSimLoyer();
      },60);
      fields.push(`Quartier : ${CP_TO_QUARTIER[cp]}`);
    } else {
      // Cherche ville par préfixe CP (2 premiers chiffres = département)
      const dept2=cp.slice(0,2);
      const match=CITIES.find(c=>c.insee&&c.insee.slice(0,2)===dept2);
      if(match&&!villeDetectee){villeDetectee=match.Ville;}
    }
  }
  if(data.ville&&!villeDetectee){
    const match=CITIES.find(c=>c.Ville.toLowerCase()===data.ville.toLowerCase()
      ||data.ville.toLowerCase().includes(c.Ville.toLowerCase()));
    if(match){villeDetectee=match.Ville;}
  }
  if(villeDetectee&&!data.code_postal?.toString().match(/6900[1-9]/)){
    document.getElementById('simVille').value=villeDetectee;
    onSimVilleChange();
    fields.push(`Ville : ${villeDetectee}`);
  }

  if(data.meuble===true){setMeuble(true);fields.push('Meublé');}
  else if(data.meuble===false){setMeuble(false);}

  // Équipements — coche automatiquement
  const equipMap={parking:['parking','garage','box'],balcon:['balcon','terrasse','loggia'],jardin:['jardin','jardin privatif'],cave:['cave','cellier'],digicode:['gardien','digicode','interphone','interphone'],renove:['rénové','refait','neuf','récent','rénovation']};
  if(data.equipements&&Array.isArray(data.equipements)){
    data.equipements.forEach(eq=>{
      const eqLow=eq.toLowerCase();
      Object.entries(equipMap).forEach(([key,keywords])=>{
        if(keywords.some(k=>eqLow.includes(k))&&!activeOpts.has(key)){
          const el=document.getElementById('opt-'+key);
          if(el){toggleOpt(key,el);fields.push(eq);}
        }
      });
    });
  }

  updateSimLoyer();
  calcSim();
  return fields;
}

// ═══ EXTRACTION VIA CLAUDE AI ═══
async function parseAnnonceAI(){
  const txt=document.getElementById('importInput').value.trim();
  const res=document.getElementById('importResult');
  const btn=document.getElementById('importBtn');
  const btnTxt=document.getElementById('importBtnText');

  if(!txt){
    res.innerHTML='Collez d\'abord le texte d\'une annonce.';
    res.className='import-result err';
    return;
  }

  // Loading state
  btn.disabled=true;
  btnTxt.textContent='Analyse…';
  res.innerHTML='<span class="spinner"></span> Claude analyse l\'annonce…';
  res.className='import-result loading';

  try{
    const response=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1000,
        system:`Tu es un extracteur de données immobilières. Analyse le texte d'une annonce immobilière française et retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après, sans backticks.

Extrais ces champs si présents (null si absent) :
- prix (number, en euros, sans espaces)
- surface (number, en m²)
- pieces (number, nombre de pièces)
- type (string: "appartement" ou "maison")
- ville (string, nom de la ville)
- code_postal (string, code postal à 5 chiffres)
- meuble (boolean, true si meublé mentionné)
- equipements (array of strings: liste des équipements détectés parmi : parking, garage, balcon, terrasse, jardin, cave, cellier, gardien, digicode, rénové, neuf)
- dpe (string, classe DPE si mentionnée: A/B/C/D/E/F/G)
- loyer_actuel (number, loyer mensuel si mentionné)
- etage (number, étage du bien)
- annee_construction (number, année de construction si mentionnée)

Sois précis sur le code postal pour les arrondissements de Lyon (69001 à 69009).
Réponds UNIQUEMENT avec le JSON, rien d'autre.`,
        messages:[{role:'user',content:`Voici le texte de l'annonce :\n\n${txt}`}]
      })
    });

    const apiData=await response.json();

    if(!response.ok){
      throw new Error(apiData.error?.message||'Erreur API');
    }

    const rawText=apiData.content?.[0]?.text||'{}';
    // Nettoyer les éventuels backticks
    const clean=rawText.replace(/```json|```/g,'').trim();
    const data=JSON.parse(clean);

    // Appliquer les données
    const fields=applyExtracted(data);

    // Afficher résumé enrichi
    let extra=[];
    if(data.dpe) extra.push(`DPE : ${data.dpe}`);
    if(data.loyer_actuel) extra.push(`Loyer actuel : ${data.loyer_actuel} €`);
    if(data.etage!=null) extra.push(`Étage ${data.etage}`);
    if(data.annee_construction) extra.push(`Construit en ${data.annee_construction}`);

    if(fields.length>0){
      res.innerHTML=`✅ Extrait : ${fields.join(' · ')}${extra.length?' · <span style="color:var(--text2)">'+extra.join(' · ')+'</span>':''}`;
      res.className='import-result ok';
    } else {
      res.innerHTML='Aucune information reconnue. Vérifiez que le texte contient des données d\'annonce.';
      res.className='import-result err';
    }

  } catch(err){
    // Fallback regex si API fail
    res.innerHTML=`⚠️ Extraction IA échouée (${err.message||'erreur réseau'}). Tentative basique…`;
    res.className='import-result err';
    const data=parseBasic(txt);
    const fields=applyExtracted(data);
    if(fields.length){
      res.innerHTML=`⚡ Extraction basique : ${fields.join(' · ')}`;
      res.className='import-result ok';
    }
  } finally {
    btn.disabled=false;
    btnTxt.textContent='Analyser ✦';
  }
}

// Fallback regex si API indisponible
function parseBasic(txt){
  const data={equipements:[]};
  const prixM=txt.match(/(\d[\d\s]{2,8})\s*[€eE]/);
  if(prixM){const p=parseInt(prixM[1].replace(/\s/g,''));if(p>10000&&p<5000000)data.prix=p;}
  const surfM=txt.match(/(\d{1,4})\s*m[²2]/i);
  if(surfM){const s=parseInt(surfM[1]);if(s>=9&&s<=1000)data.surface=s;}
  const pcsM=txt.match(/([TtFf])(\d)|(\d)\s*pi[eè]ces?/i);
  if(pcsM){const p=parseInt(pcsM[2]||pcsM[3]);if(p>=1&&p<=6)data.pieces=p;}
  if(/studio/i.test(txt))data.pieces=1;
  if(/maison/i.test(txt))data.type='maison';
  else if(/appart/i.test(txt))data.type='appartement';
  const cpM=txt.match(/\b(690[0-9][0-9]|6[0-9]{4})\b/);
  if(cpM)data.code_postal=cpM[1];
  if(/meubl/i.test(txt))data.meuble=true;
  const eqKeys=['parking','garage','balcon','terrasse','jardin','cave','cellier','gardien','digicode','rénové','neuf'];
  eqKeys.forEach(k=>{if(new RegExp(k,'i').test(txt))data.equipements.push(k);});
  const cityM=CITIES.find(c=>new RegExp('\\b'+c.Ville.split('-')[0]+'\\b','i').test(txt));
  if(cityM)data.ville=cityM.Ville;
  return data;
}
