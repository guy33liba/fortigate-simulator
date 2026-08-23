/* FortiOS 7.0-style IPsec SA monitor, counters, rekey and event diagnostics. */
let vmonMaintenanceTimer = null;

function vmonRandomHex(seed, length=8){
  let x=(Number(seed)||Date.now())>>>0, out='';
  while(out.length<length){x=(Math.imul(x,1664525)+1013904223)>>>0;out+=x.toString(16).padStart(8,'0');}
  return out.slice(0,length);
}

function vmonDefaultSa(vpn={}){
  return {
    phase1SpiIn:'',phase1SpiOut:'',phase2SpiIn:'',phase2SpiOut:'',
    phase1EstablishedAt:0,phase2EstablishedAt:0,lastRekeyAt:0,rekeys:0,
    packetsIn:0,packetsOut:0,bytesIn:0,bytesOut:0,lastTrafficAt:0,
    dpdState:vpn.dpd===false?'Disabled':'Idle',sequence:0
  };
}

function vmonNormalizeSa(vpn){
  const old=vpn?.sa||{}, base=vmonDefaultSa(vpn);
  return {
    ...base,...old,
    phase1EstablishedAt:Number(old.phase1EstablishedAt||0),
    phase2EstablishedAt:Number(old.phase2EstablishedAt||0),
    lastRekeyAt:Number(old.lastRekeyAt||0),
    rekeys:Number(old.rekeys||0),packetsIn:Number(old.packetsIn||0),packetsOut:Number(old.packetsOut||0),
    bytesIn:Number(old.bytesIn||0),bytesOut:Number(old.bytesOut||0),lastTrafficAt:Number(old.lastTrafficAt||0),sequence:Number(old.sequence||0)
  };
}

const vmonCoreVpnNormalize=vpnNormalize;
vpnNormalize=function(vpn){
  const normalized=vmonCoreVpnNormalize(vpn);
  normalized.sa=vmonNormalizeSa(vpn);
  return normalized;
};

function vmonEnsureState(){
  (state.vpns||[]).forEach(v=>{v.sa=vmonNormalizeSa(v);});
  saveState();
}

function vmonGenerateSpis(vpn, phase='both'){
  const sa=vpn.sa=vmonNormalizeSa(vpn), now=Date.now(), seed=hashText(`${vpn.id}|${vpn.name}|${now}|${sa.sequence}`);
  sa.sequence+=1;
  if(phase==='both'||phase==='phase1'){
    sa.phase1SpiIn=vmonRandomHex(seed,16);sa.phase1SpiOut=vmonRandomHex(seed^0x6a09e667,16);sa.phase1EstablishedAt=now;
  }
  if(phase==='both'||phase==='phase2'){
    sa.phase2SpiIn=`0x${vmonRandomHex(seed^0xbb67ae85,8)}`;sa.phase2SpiOut=`0x${vmonRandomHex(seed^0x3c6ef372,8)}`;sa.phase2EstablishedAt=now;
  }
  sa.lastRekeyAt=now;sa.dpdState=vpn.dpd===false?'Disabled':'Alive';
}

function vmonClearLiveSa(vpn){
  const sa=vpn.sa=vmonNormalizeSa(vpn);
  sa.phase1SpiIn='';sa.phase1SpiOut='';sa.phase2SpiIn='';sa.phase2SpiOut='';
  sa.phase1EstablishedAt=0;sa.phase2EstablishedAt=0;sa.dpdState=vpn.dpd===false?'Disabled':'Down';
}

const vmonCoreVpnBringUp=vpnBringUp;
vpnBringUp=function(vpn){
  vmonCoreVpnBringUp(vpn);
  if(vpn.phase1Up&&vpn.phase2Up){
    vmonGenerateSpis(vpn,'both');
    vpnEvent(vpn,'info',`IPsec SAs installed: P1 ${vpn.sa.phase1SpiIn}/${vpn.sa.phase1SpiOut}, P2 ${vpn.sa.phase2SpiIn}/${vpn.sa.phase2SpiOut}`);
    saveState();vpnRender();vmonRenderEvents();
  }
};

const vmonCoreVpnBringDown=vpnBringDown;
vpnBringDown=function(vpn,reason='Tunnel down'){
  vmonCoreVpnBringDown(vpn,reason);
  vmonClearLiveSa(vpn);saveState();vpnRender();vmonRenderEvents();
};

function vmonRekey(vpn,phase='phase2',automatic=false){
  if(!vpn||!vpn.phase1Up||!vpn.phase2Up){if(!automatic)alert('Bring the IPsec tunnel up before rekeying.');return false;}
  const sa=vpn.sa=vmonNormalizeSa(vpn);
  if(phase==='phase1')vmonGenerateSpis(vpn,'both');else vmonGenerateSpis(vpn,'phase2');
  sa.rekeys+=1;
  vpnEvent(vpn,'info',`${automatic?'Automatic':'Manual'} ${phase==='phase1'?'Phase 1 + Phase 2':'Phase 2'} rekey completed`);
  saveState();vpnRender();vmonRenderEvents();return true;
}

function vmonRemaining(establishedAt,lifetime){
  if(!establishedAt)return 0;
  return Math.max(0,Number(lifetime||0)-Math.floor((Date.now()-establishedAt)/1000));
}

function vmonUptime(vpn){
  const start=vpn.sa?.phase2EstablishedAt;if(!vpn.phase2Up||!start)return '—';
  const sec=Math.max(0,Math.floor((Date.now()-start)/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function vmonPrepareTunnelView(){
  const toolbar=$('ipsec-tunnels-toolbar');
  if(toolbar&&!$('vpn-monitor-button')){
    toolbar.insertAdjacentHTML('beforeend',`<button id="vpn-monitor-button" class="btn-secondary" disabled>▣ Monitor</button><button id="vpn-rekey-button" class="btn-secondary" disabled>↻ Rekey</button><button id="vpn-clear-sa-button" class="btn-secondary" disabled>× Clear SAs</button><button id="vpn-test-tunnel-button" class="btn-secondary" disabled>▶ Test Tunnel</button>`);
  }
  const head=$('ipsec-tunnels-table')?.querySelector('thead tr');
  if(head&&!head.querySelector('[data-vmon="uptime"]'))head.insertAdjacentHTML('beforeend','<th data-vmon="uptime">Uptime</th><th data-vmon="traffic">Traffic</th>');
  const view=$('view-ipsec-tunnels');
  if(view&&!$('vpn-ipsec-events-section')){
    view.insertAdjacentHTML('beforeend',`<section id="vpn-ipsec-events-section" class="forti-form-section"><h2 id="vpn-ipsec-events-title">IPsec Events</h2><div id="vpn-ipsec-events-toolbar" class="toolbar"><button id="vpn-events-clear-button" class="btn-secondary" type="button">Clear Events</button></div><div id="vpn-ipsec-events-wrap" class="table-wrap full-table-wrap"><table id="vpn-ipsec-events-table" class="data-table"><thead><tr><th>Time</th><th>Tunnel</th><th>Level</th><th>Message</th></tr></thead><tbody id="vpn-ipsec-events-body"></tbody></table></div></section>`);
  }
}

const vmonCoreVpnRender=vpnRender;
vpnRender=function(){
  vmonCoreVpnRender();
  vmonPrepareTunnelView();
  const rows=[...($('ipsec-tunnels-body')?.querySelectorAll('tr')||[])];
  (state.vpns||[]).forEach((vpn,index)=>{
    const row=rows[index];if(!row)return;
    while(row.children.length>9)row.removeChild(row.lastElementChild);
    const sa=vpn.sa=vmonNormalizeSa(vpn);
    row.insertAdjacentHTML('beforeend',`<td>${esc(vmonUptime(vpn))}</td><td>${formatBytes(sa.bytesOut)} ↑ / ${formatBytes(sa.bytesIn)} ↓</td>`);
  });
  vmonUpdateButtons();vmonRenderEvents();
};

function vmonUpdateButtons(){
  const vpn=vpnSelected(),up=Boolean(vpn&&vpn.phase1Up&&vpn.phase2Up);
  ['vpn-monitor-button','vpn-test-tunnel-button'].forEach(id=>{if($(id))$(id).disabled=!vpn;});
  if($('vpn-rekey-button'))$('vpn-rekey-button').disabled=!up;
  if($('vpn-clear-sa-button'))$('vpn-clear-sa-button').disabled=!up;
}

function vmonMonitor(vpn){
  if(!vpn)return;const sa=vpn.sa=vmonNormalizeSa(vpn),p1Left=vmonRemaining(sa.phase1EstablishedAt,vpn.keyLifetime),p2Left=vmonRemaining(sa.phase2EstablishedAt,vpn.phase2Lifetime);
  const route=state.routes.find(r=>r.enabled!==false&&r.destination===vpn.remoteSubnet&&r.interface===vpn.name),localIf=vpnFindLocalInterface(vpn.localSubnet);
  const outPolicy=localIf&&state.policies.find(p=>p.enabled!==false&&p.from===localIf.name&&p.to===vpn.name),inPolicy=localIf&&state.policies.find(p=>p.enabled!==false&&p.from===vpn.name&&p.to===localIf.name);
  openModal(`IPsec Monitor - ${vpn.name}`,`<dl class="forti-log-detail-grid"><dt>Status</dt><dd>${vpn.phase1Up&&vpn.phase2Up?'UP':'DOWN'}</dd><dt>Remote Gateway</dt><dd>${esc(vpn.remoteGateway)}</dd><dt>Interface</dt><dd>${esc(vpn.interface)}</dd><dt>IKE</dt><dd>IKEv${esc(vpn.ikeVersion)} ${esc(vpn.encryption)}/${esc(vpn.authentication)} DH${esc(vpn.dhGroup)}</dd><dt>Phase 1 SPI IN</dt><dd>${esc(sa.phase1SpiIn||'—')}</dd><dt>Phase 1 SPI OUT</dt><dd>${esc(sa.phase1SpiOut||'—')}</dd><dt>Phase 1 Lifetime</dt><dd>${vpn.phase1Up?`${p1Left}s remaining / ${vpn.keyLifetime}s`:'—'}</dd><dt>Phase 2 SPI IN</dt><dd>${esc(sa.phase2SpiIn||'—')}</dd><dt>Phase 2 SPI OUT</dt><dd>${esc(sa.phase2SpiOut||'—')}</dd><dt>Phase 2 Lifetime</dt><dd>${vpn.phase2Up?`${p2Left}s remaining / ${vpn.phase2Lifetime}s`:'—'}</dd><dt>Selectors</dt><dd>${esc(vpn.localSubnet)} ↔ ${esc(vpn.remoteSubnet)}</dd><dt>DPD</dt><dd>${esc(sa.dpdState)}</dd><dt>Rekeys</dt><dd>${sa.rekeys}</dd><dt>Packets</dt><dd>${sa.packetsOut} out / ${sa.packetsIn} in</dd><dt>Traffic</dt><dd>${formatBytes(sa.bytesOut)} sent / ${formatBytes(sa.bytesIn)} received</dd><dt>Route</dt><dd>${route?`${esc(route.destination)} → ${esc(route.interface)}`:'Missing'}</dd><dt>Outbound Policy</dt><dd>${esc(outPolicy?.name||'Missing')}</dd><dt>Inbound Policy</dt><dd>${esc(inPolicy?.name||'Missing')}</dd><dt>Last Traffic</dt><dd>${sa.lastTrafficAt?new Date(sa.lastTrafficAt).toLocaleString():'—'}</dd></dl>`,[
    {label:'Close',className:'btn-secondary',action:closeModal},
    {label:'Rekey Phase 2',className:'btn-secondary',action:()=>{closeModal();vmonRekey(vpn,'phase2');}},
    {label:'Diagnose',className:'btn-primary',action:()=>{closeModal();vpnDiagnose(vpn);}}
  ]);
}

function vmonCidrHost(cidr,offset=10){
  if(!isCIDR(cidr))return '';
  const [ip,prefixText]=cidr.split('/'),prefix=Number(prefixText),mask=rtPrefixToMask(prefix),net=ipToInt(networkAddress(ip,mask)),size=Math.pow(2,32-prefix),last=(net+size-1)>>>0;
  const candidate=Math.min(last-1,(net+Math.max(1,offset))>>>0);return candidate>net?intToIp(candidate>>>0):ip;
}

function vmonTestTunnel(vpn){
  if(!vpn)return;const localIf=vpnFindLocalInterface(vpn.localSubnet);
  if(!localIf){alert(`No local interface belongs to ${vpn.localSubnet}.`);return;}
  openTrafficModal();
  if($('test-incoming'))$('test-incoming').value=localIf.name;
  if($('test-outgoing'))$('test-outgoing').value=vpn.name;
  if($('test-source'))$('test-source').value=vmonCidrHost(vpn.localSubnet,10);
  if($('test-destination'))$('test-destination').value=vmonCidrHost(vpn.remoteSubnet,10);
  if($('test-service'))$('test-service').value='PING';
  if($('test-vlan-tag'))$('test-vlan-tag').value='';
  const help=$('test-vlan-help');if(help)help.textContent=`IPsec test ${vpn.localSubnet} → ${vpn.remoteSubnet}: route → ${vpn.name} → selectors → firewall policy → IPsec SA → return path.`;
}

function vmonClearSelectedSa(){
  const vpn=vpnSelected();if(!vpn)return;
  if(confirm(`Clear active IPsec SAs for "${vpn.name}"?`))vpnBringDown(vpn,'IPsec SAs cleared by administrator');
}
function vmonClearEvents(){state.vpnEvents=[];saveState();vmonRenderEvents();}
function vmonRenderEvents(){
  const body=$('vpn-ipsec-events-body');if(!body)return;body.innerHTML='';
  [...(state.vpnEvents||[])].slice(-100).reverse().forEach(e=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(new Date(e.timestamp).toLocaleString())}</td><td>${esc(e.tunnel||'—')}</td><td class="${e.level==='error'?'status-deny':'status-up'}">${esc(String(e.level||'info').toUpperCase())}</td><td>${esc(e.message||'')}</td>`;body.append(tr);});
}

const vmonCoreRunTraffic=runTraffic;
runTraffic=function(){
  const before=state.logs.length;vmonCoreRunTraffic();
  if(state.logs.length<=before)return;
  const log=state.logs[state.logs.length-1];if(log.action!=='ACCEPT')return;
  const outgoingVpn=(state.vpns||[]).find(v=>v.name===log.outgoing),incomingVpn=(state.vpns||[]).find(v=>v.name===log.incoming||v.name===log.originalIncoming);
  const now=Date.now();
  if(outgoingVpn){const sa=outgoingVpn.sa=vmonNormalizeSa(outgoingVpn);sa.packetsOut+=1;sa.packetsIn+=1;sa.bytesOut+=Number(log.bytesSent||0);sa.bytesIn+=Number(log.bytesReceived||0);sa.lastTrafficAt=now;sa.dpdState=outgoingVpn.dpd===false?'Disabled':'Alive';}
  if(incomingVpn&&incomingVpn!==outgoingVpn){const sa=incomingVpn.sa=vmonNormalizeSa(incomingVpn);sa.packetsIn+=1;sa.packetsOut+=1;sa.bytesIn+=Number(log.bytesSent||0);sa.bytesOut+=Number(log.bytesReceived||0);sa.lastTrafficAt=now;sa.dpdState=incomingVpn.dpd===false?'Disabled':'Alive';}
  if(outgoingVpn||incomingVpn){saveState();vpnRender();}
};

function vmonMaintenance(){
  let changed=false;
  (state.vpns||[]).forEach(vpn=>{
    if(!vpn.phase1Up&&!vpn.phase2Up)return;
    const sa=vpn.sa=vmonNormalizeSa(vpn);
    if(vpn.dpd!==false&&!vpn.peerResponds){
      vmonCoreVpnBringDown(vpn,'DPD detected unreachable peer');vmonClearLiveSa(vpn);changed=true;return;
    }
    if(vpn.phase1Up&&sa.phase1EstablishedAt&&vmonRemaining(sa.phase1EstablishedAt,vpn.keyLifetime)<=0){
      if(vpn.autoNegotiate){vmonGenerateSpis(vpn,'both');sa.rekeys+=1;vpnEvent(vpn,'info','Automatic Phase 1 rekey completed');changed=true;}
      else{vmonCoreVpnBringDown(vpn,'Phase 1 lifetime expired');vmonClearLiveSa(vpn);changed=true;return;}
    }
    if(vpn.phase2Up&&sa.phase2EstablishedAt&&vmonRemaining(sa.phase2EstablishedAt,vpn.phase2Lifetime)<=0){
      if(vpn.autoNegotiate){vmonGenerateSpis(vpn,'phase2');sa.rekeys+=1;vpnEvent(vpn,'info','Automatic Phase 2 rekey completed');changed=true;}
      else{vmonCoreVpnBringDown(vpn,'Phase 2 lifetime expired');vmonClearLiveSa(vpn);changed=true;}
    }
  });
  if(changed){saveState();renderAll();}
  else if($('view-ipsec-tunnels')?.classList.contains('active-view'))vpnRender();
}

function vmonBind(){
  $('vpn-monitor-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vmonMonitor(v);});
  $('vpn-rekey-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vmonRekey(v,'phase2');});
  $('vpn-clear-sa-button')?.addEventListener('click',vmonClearSelectedSa);
  $('vpn-test-tunnel-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vmonTestTunnel(v);});
  $('vpn-events-clear-button')?.addEventListener('click',vmonClearEvents);
  if(!vmonMaintenanceTimer)vmonMaintenanceTimer=setInterval(vmonMaintenance,5000);
}

const vmonCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim(),lower=text.toLowerCase();let m;
  if(lower==='diagnose vpn ike gateway list'){
    cli(`FG-SIM-01 # ${text}`);const list=state.vpns||[];cli(list.length?list.map(v=>{const sa=v.sa=vmonNormalizeSa(v);return`name=${v.name} version=IKEv${v.ikeVersion} interface=${v.interface} peer=${v.remoteGateway} status=${v.phase1Up?'up':'down'} spi=${sa.phase1SpiIn||'-'}/${sa.phase1SpiOut||'-'} dpd=${sa.dpdState}`;}).join('\n'):'No IKE gateways.');return;
  }
  if((m=text.match(/^diagnose vpn ike gateway list name\s+(.+)$/i))){
    const name=m[1].replace(/^['\"]|['\"]$/g,'').trim(),v=(state.vpns||[]).find(x=>x.name===name);cli(`FG-SIM-01 # ${text}`);if(!v){cli(`Tunnel ${name} not found.`);return;}const sa=v.sa=vmonNormalizeSa(v);cli(`vd: root/0\nname: ${v.name}\nversion: IKEv${v.ikeVersion}\ninterface: ${v.interface}\npeer: ${v.remoteGateway}\nstatus: ${v.phase1Up?'established':'down'}\nIKE SA: ${sa.phase1SpiIn||'-'} / ${sa.phase1SpiOut||'-'}\nDPD: ${sa.dpdState}\nremaining: ${vmonRemaining(sa.phase1EstablishedAt,v.keyLifetime)}s`);return;
  }
  if((m=text.match(/^diagnose vpn tunnel rekey\s+(.+)$/i))){const name=m[1].trim(),v=(state.vpns||[]).find(x=>x.name===name);cli(`FG-SIM-01 # ${text}`);if(!v){cli(`Tunnel ${name} not found.`);return;}cli(vmonRekey(v,'phase2')?'Phase 2 rekey completed.':'Tunnel is not up.');return;}
  if((m=text.match(/^diagnose vpn tunnel flush\s+(.+)$/i))){const name=m[1].trim(),v=(state.vpns||[]).find(x=>x.name===name);cli(`FG-SIM-01 # ${text}`);if(!v){cli(`Tunnel ${name} not found.`);return;}vpnBringDown(v,'IPsec SAs flushed from CLI');cli(`Flushed SAs for ${name}.`);return;}
  if(lower==='diagnose vpn ipsec status'){
    cli(`FG-SIM-01 # ${text}`);const list=state.vpns||[];cli(list.length?list.map(v=>{const sa=v.sa=vmonNormalizeSa(v);return`${v.name}: ${v.phase1Up&&v.phase2Up?'up':'down'} uptime=${vmonUptime(v)} p2spi=${sa.phase2SpiIn||'-'}/${sa.phase2SpiOut||'-'} packets=${sa.packetsOut}/${sa.packetsIn} bytes=${sa.bytesOut}/${sa.bytesIn} rekeys=${sa.rekeys}`;}).join('\n'):'No IPsec tunnels.');return;
  }
  vmonCoreRunCli(text);
};

vmonEnsureState();
vmonPrepareTunnelView();
document.addEventListener('DOMContentLoaded',()=>{vmonPrepareTunnelView();vmonBind();vpnRender();vmonRenderEvents();});
