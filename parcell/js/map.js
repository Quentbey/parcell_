// map.js — Carte Leaflet interactive

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
