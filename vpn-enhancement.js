/* FortiOS 7.0-style Site-to-Site IPsec VPN simulator. */
let vpnSelectedId = null;
let vpnEditingId = null;

function vpnInitState(){
  state.vpns ||= [];
  state.vpnEvents ||= [];
  state.vpns = state.vpns.map(vpnNormalize);
  vpnSyncAll();
  saveState();
}

function vpnNormalize(vpn){
  return {
    id:vpn.id||uid(),
    name:vpn.name||'to-branch',
    type:'Site to Site',
    enabled:vpn.enabled!==false,
    interface:vpn.interface||'wan',
    remoteGateway:vpn.remoteGateway||'203.0.113.2',
    authMethod:vpn.authMethod||'Pre-shared Key',
    psk:vpn.psk||'',
    ikeVersion:String(vpn.ikeVersion||'2'),
    encryption:vpn.encryption||'AES256',
    authentication:vpn.authentication||'SHA256',
    dhGroup:String(vpn.dhGroup||'14'),
    keyLifetime:Number(vpn.keyLifetime||28800),
    natTraversal:vpn.natTraversal!==false,
    dpd:vpn.dpd!==false,
    localSubnet:vpn.localSubnet||'192.168.1.0/24',
    remoteSubnet:vpn.remoteSubnet||'192.168.2.0/24',
    phase2Encryption:vpn.phase2Encryption||'AES256',
    phase2Authentication:vpn.phase2Authentication||'SHA256',
    pfs:vpn.pfs!==false,
    phase2DhGroup:String(vpn.phase2DhGroup||'14'),
    phase2Lifetime:Number(vpn.phase2Lifetime||3600),
    autoNegotiate:vpn.autoNegotiate!==false,
    peerResponds:vpn.peerResponds!==false,
    peerPhase1Match:vpn.peerPhase1Match!==false,
    peerPhase2Match:vpn.peerPhase2Match!==false,
    phase1Up:Boolean(vpn.phase1Up),
    phase2Up:Boolean(vpn.phase2Up),
    lastError:vpn.lastError||'',
    createdAt:Number(vpn.createdAt||Date.now()),
    lastChange:Number(vpn.lastChange||Date.now())
  };
}

function vpnPrepareNavigation(){
  const old=$('nav-vpn');
  if(!old||$('vpn-group'))return;
  const group=document.createElement('div');
  group.id='vpn-group';group.className='nav-group';
  group.innerHTML=`<button id="nav-vpn-parent" class="nav-item nav-parent" type="button" aria-expanded="false" aria-controls="vpn-subnav"><span class="nav-icon">▱</span><span>VPN</span><span class="nav-chevron">›</span></button><div id="vpn-subnav" class="subnav" hidden><button id="nav-ipsec-wizard" class="subnav-item" data-view="ipsec-wizard" type="button">IPsec Wizard</button><button id="nav-ipsec-tunnels" class="subnav-item" data-view="ipsec-tunnels" type="button">IPsec Tunnels</button></div>`;
  old.replaceWith(group);
}

function vpnPrepareViews(){
  const main=$('main-content');if(!main)return;
  if(!$('view-ipsec-tunnels')){
    main.insertAdjacentHTML('beforeend',`<section id="view-ipsec-tunnels" class="app-view"><div id="ipsec-tunnels-header" class="page-heading-row"><h1 id="ipsec-tunnels-title">IPsec Tunnels</h1></div><div id="ipsec-tunnels-toolbar" class="toolbar"><button id="vpn-create-button" class="btn-primary">＋ Create New</button><button id="vpn-edit-button" class="btn-secondary" disabled>✎ Edit</button><button id="vpn-delete-button" class="btn-secondary" disabled>▱ Delete</button><button id="vpn-up-button" class="btn-secondary" disabled>▲ Bring Up</button><button id="vpn-down-button" class="btn-secondary" disabled>▼ Bring Down</button><button id="vpn-route-button" class="btn-secondary" disabled>＋ Route</button><button id="vpn-policy-button" class="btn-secondary" disabled>＋ Policies</button><button id="vpn-diagnose-button" class="btn-secondary" disabled>⌕ Diagnose</button></div><div id="ipsec-tunnels-wrap" class="table-wrap full-table-wrap"><table id="ipsec-tunnels-table" class="data-table"><thead><tr><th>Status</th><th>Name</th><th>Remote Gateway</th><th>Interface</th><th>IKE</th><th>Phase 1</th><th>Phase 2</th><th>Local Network</th><th>Remote Network</th></tr></thead><tbody id="ipsec-tunnels-body"></tbody></table></div><div id="ipsec-tunnels-help" class="muted">Tunnel UP only proves IKE/IPsec negotiation. Route, firewall policies and NAT still determine whether traffic passes.</div></section>`);
  }
  if(!$('view-ipsec-wizard')){
    main.insertAdjacentHTML('beforeend',`<section id="view-ipsec-wizard" class="app-view"><div id="ipsec-wizard-header" class="page-heading-row"><h1 id="ipsec-wizard-title">IPsec Wizard</h1></div><form id="ipsec-wizard-form" novalidate><div id="ipsec-wizard-toolbar" class="toolbar"><button id="vpn-save-top" type="submit" class="btn-primary">OK</button><button id="vpn-cancel-top" type="button" class="btn-secondary">Cancel</button></div><section id="vpn-setup-section" class="forti-form-section"><h2 id="vpn-setup-title">VPN Setup</h2><div id="vpn-setup-fields" class="forti-form-body"><div id="field-vpn-name" class="forti-field-row"><label for="vpn-name">Name</label><div><input id="vpn-name" type="text" value="to-branch"></div></div><div id="field-vpn-template" class="forti-field-row"><label>Template Type</label><div class="forti-radio-row"><label><input id="vpn-template-site" type="radio" name="vpn-template" checked> Site to Site</label></div></div><div id="field-vpn-enabled" class="forti-field-row"><label>Status</label><div><label class="forti-switch"><input id="vpn-enabled" type="checkbox" checked><span></span></label></div></div></div></section><section id="vpn-network-section" class="forti-form-section"><h2 id="vpn-network-title">Network</h2><div class="forti-form-body"><div id="field-vpn-interface" class="forti-field-row"><label for="vpn-interface">Interface</label><div><select id="vpn-interface"></select></div></div><div id="field-vpn-peer" class="forti-field-row"><label for="vpn-peer">Remote Gateway</label><div><input id="vpn-peer" type="text" value="203.0.113.2"></div></div></div></section><section id="vpn-auth-section" class="forti-form-section"><h2 id="vpn-auth-title">Authentication / Phase 1</h2><div class="forti-form-body"><div id="field-vpn-auth-method" class="forti-field-row"><label>Method</label><div><select id="vpn-auth-method"><option>Pre-shared Key</option></select></div></div><div id="field-vpn-psk" class="forti-field-row"><label for="vpn-psk">Pre-shared Key</label><div><input id="vpn-psk" type="password" autocomplete="new-password" placeholder="Enter matching key"></div></div><div id="field-vpn-ike" class="forti-field-row"><label for="vpn-ike">IKE Version</label><div><select id="vpn-ike"><option value="2">IKEv2</option><option value="1">IKEv1</option></select></div></div><div id="field-vpn-phase1-proposal" class="forti-field-row"><label>Proposal</label><div class="inline-controls"><select id="vpn-encryption"><option>AES256</option><option>AES128</option><option>3DES</option></select><select id="vpn-authentication"><option>SHA256</option><option>SHA1</option></select></div></div><div id="field-vpn-dh" class="forti-field-row"><label for="vpn-dh">Diffie-Hellman Group</label><div><select id="vpn-dh"><option>14</option><option>19</option><option>20</option><option>5</option></select></div></div><div id="field-vpn-p1-lifetime" class="forti-field-row"><label for="vpn-p1-lifetime">Key Lifetime</label><div class="inline-controls"><input id="vpn-p1-lifetime" type="number" min="120" max="172800" value="28800"><span>seconds</span></div></div><div id="field-vpn-nat-t" class="forti-field-row"><label>NAT Traversal</label><div><label class="forti-switch"><input id="vpn-nat-t" type="checkbox" checked><span></span></label></div></div><div id="field-vpn-dpd" class="forti-field-row"><label>Dead Peer Detection</label><div><label class="forti-switch"><input id="vpn-dpd" type="checkbox" checked><span></span></label></div></div></div></section><section id="vpn-phase2-section" class="forti-form-section"><h2 id="vpn-phase2-title">Phase 2 Selectors</h2><div class="forti-form-body"><div id="field-vpn-local" class="forti-field-row"><label for="vpn-local">Local Address</label><div><input id="vpn-local" type="text" value="192.168.1.0/24"></div></div><div id="field-vpn-remote" class="forti-field-row"><label for="vpn-remote">Remote Address</label><div><input id="vpn-remote" type="text" value="192.168.2.0/24"></div></div><div id="field-vpn-phase2-proposal" class="forti-field-row"><label>Proposal</label><div class="inline-controls"><select id="vpn-p2-encryption"><option>AES256</option><option>AES128</option><option>3DES</option></select><select id="vpn-p2-authentication"><option>SHA256</option><option>SHA1</option></select></div></div><div id="field-vpn-pfs" class="forti-field-row"><label>Perfect Forward Secrecy</label><div><label class="forti-switch"><input id="vpn-pfs" type="checkbox" checked><span></span></label></div></div><div id="field-vpn-p2-dh" class="forti-field-row"><label for="vpn-p2-dh">DH Group</label><div><select id="vpn-p2-dh"><option>14</option><option>19</option><option>20</option><option>5</option></select></div></div><div id="field-vpn-p2-lifetime" class="forti-field-row"><label for="vpn-p2-lifetime">Key Lifetime</label><div class="inline-controls"><input id="vpn-p2-lifetime" type="number" min="120" max="172800" value="3600"><span>seconds</span></div></div><div id="field-vpn-auto-negotiate" class="forti-field-row"><label>Auto-negotiate</label><div><label class="forti-switch"><input id="vpn-auto-negotiate" type="checkbox" checked><span></span></label></div></div></div></section><section id="vpn-peer-sim-section" class="forti-form-section"><h2 id="vpn-peer-sim-title">Remote Peer Simulation</h2><div class="forti-form-body"><div id="field-vpn-peer-responds" class="forti-field-row"><label>Remote peer reachable</label><div><label class="forti-switch"><input id="vpn-peer-responds" type="checkbox" checked><span></span></label></div></div><div id="field-vpn-peer-p1" class="forti-field-row"><label>Phase 1 settings match</label><div><label class="forti-switch"><input id="vpn-peer-p1" type="checkbox" checked><span></span></label></div></div><div id="field-vpn-peer-p2" class="forti-field-row"><label>Phase 2 selectors match</label><div><label class="forti-switch"><input id="vpn-peer-p2" type="checkbox" checked><span></span></label></div></div></div></section><div id="vpn-editor-errors" class="muted"></div><div id="vpn-wizard-actions" class="toolbar"><button id="vpn-save-bottom" type="submit" class="btn-primary">OK</button><button id="vpn-cancel-bottom" type="button" class="btn-secondary">Cancel</button></div></form></section>`);
  }
}

function vpnBind(){
  $('vpn-create-button')?.addEventListener('click',()=>vpnOpenWizard());
  $('vpn-edit-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vpnOpenWizard(v);});
  $('vpn-delete-button')?.addEventListener('click',vpnDelete);
  $('vpn-up-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vpnBringUp(v);});
  $('vpn-down-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vpnBringDown(v,'Manually brought down');});
  $('vpn-route-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vpnCreateRoute(v);});
  $('vpn-policy-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vpnCreatePolicies(v);});
  $('vpn-diagnose-button')?.addEventListener('click',()=>{const v=vpnSelected();if(v)vpnDiagnose(v);});
  $('ipsec-wizard-form')?.addEventListener('submit',e=>{e.preventDefault();vpnSaveWizard();});
  $('vpn-cancel-top')?.addEventListener('click',vpnCancelWizard);
  $('vpn-cancel-bottom')?.addEventListener('click',vpnCancelWizard);
}

function vpnSelected(){return state.vpns.find(v=>v.id===vpnSelectedId)||null;}

function vpnFillInterfaces(selected='wan'){
  const el=$('vpn-interface');if(!el)return;
  const candidates=state.interfaces.filter(i=>i.type!=='IPsec Tunnel'&&i.role==='WAN'&&i.enabled!==false);
  const list=candidates.length?candidates:state.interfaces.filter(i=>i.type!=='IPsec Tunnel'&&i.enabled!==false);
  el.innerHTML=list.map(i=>`<option value="${esc(i.name)}">${esc(i.name)}${i.role?` (${esc(i.role)})`:''}</option>`).join('');
  if(list.some(i=>i.name===selected))el.value=selected;
}

function vpnOpenWizard(vpn=null){
  vpnEditingId=vpn?.id||null;
  const v=vpn?vpnNormalize(vpn):vpnNormalize({name:'to-branch',interface:'wan',localSubnet:'192.168.1.0/24',remoteSubnet:'192.168.2.0/24'});
  $('ipsec-wizard-title').textContent=vpn?'Edit IPsec Tunnel':'IPsec Wizard';
  $('vpn-name').value=v.name;$('vpn-name').disabled=Boolean(vpn);
  $('vpn-enabled').checked=v.enabled;vpnFillInterfaces(v.interface);$('vpn-peer').value=v.remoteGateway;
  $('vpn-auth-method').value=v.authMethod;$('vpn-psk').value=v.psk;$('vpn-ike').value=v.ikeVersion;
  $('vpn-encryption').value=v.encryption;$('vpn-authentication').value=v.authentication;$('vpn-dh').value=v.dhGroup;$('vpn-p1-lifetime').value=v.keyLifetime;
  $('vpn-nat-t').checked=v.natTraversal;$('vpn-dpd').checked=v.dpd;
  $('vpn-local').value=v.localSubnet;$('vpn-remote').value=v.remoteSubnet;$('vpn-p2-encryption').value=v.phase2Encryption;$('vpn-p2-authentication').value=v.phase2Authentication;
  $('vpn-pfs').checked=v.pfs;$('vpn-p2-dh').value=v.phase2DhGroup;$('vpn-p2-lifetime').value=v.phase2Lifetime;$('vpn-auto-negotiate').checked=v.autoNegotiate;
  $('vpn-peer-responds').checked=v.peerResponds;$('vpn-peer-p1').checked=v.peerPhase1Match;$('vpn-peer-p2').checked=v.peerPhase2Match;$('vpn-editor-errors').textContent='';
  showView('ipsec-wizard');
}

function vpnCancelWizard(){vpnEditingId=null;showView('ipsec-tunnels');vpnRender();}

function vpnSaveWizard(){
  const errors=[];const existing=state.vpns.find(v=>v.id===vpnEditingId);
  const name=$('vpn-name').value.trim();const interfaceName=$('vpn-interface').value;const remoteGateway=$('vpn-peer').value.trim();const psk=$('vpn-psk').value;
  const localSubnet=$('vpn-local').value.trim(),remoteSubnet=$('vpn-remote').value.trim();
  if(!name)errors.push('VPN name is required.');
  if(!existing&&(state.vpns.some(v=>v.name.toLowerCase()===name.toLowerCase())||state.interfaces.some(i=>i.name.toLowerCase()===name.toLowerCase())))errors.push('VPN name must be unique.');
  const wan=findByName(interfaceName);if(!wan)errors.push('Select a valid interface.');
  if(!isIPv4(remoteGateway))errors.push('Remote Gateway must be a valid IPv4 address.');
  if(!psk)errors.push('Pre-shared Key is required.');
  if(!isCIDR(localSubnet))errors.push('Local Address must be a valid IPv4 subnet in CIDR format.');
  if(!isCIDR(remoteSubnet))errors.push('Remote Address must be a valid IPv4 subnet in CIDR format.');
  if(isCIDR(localSubnet)&&isCIDR(remoteSubnet)&&vpnCidrsOverlap(localSubnet,remoteSubnet))errors.push('Local and Remote selectors overlap. Use a non-overlapping lab topology for this site-to-site exercise.');
  const p1Life=Number($('vpn-p1-lifetime').value),p2Life=Number($('vpn-p2-lifetime').value);if(!Number.isInteger(p1Life)||p1Life<120)errors.push('Phase 1 lifetime is invalid.');if(!Number.isInteger(p2Life)||p2Life<120)errors.push('Phase 2 lifetime is invalid.');
  if(errors.length){$('vpn-editor-errors').textContent=errors.join(' • ');return;}
  const payload=vpnNormalize({
    ...(existing||{}),id:existing?.id||uid(),name,enabled:$('vpn-enabled').checked,interface:interfaceName,remoteGateway,authMethod:$('vpn-auth-method').value,psk,
    ikeVersion:$('vpn-ike').value,encryption:$('vpn-encryption').value,authentication:$('vpn-authentication').value,dhGroup:$('vpn-dh').value,keyLifetime:p1Life,
    natTraversal:$('vpn-nat-t').checked,dpd:$('vpn-dpd').checked,localSubnet,remoteSubnet,phase2Encryption:$('vpn-p2-encryption').value,phase2Authentication:$('vpn-p2-authentication').value,
    pfs:$('vpn-pfs').checked,phase2DhGroup:$('vpn-p2-dh').value,phase2Lifetime:p2Life,autoNegotiate:$('vpn-auto-negotiate').checked,
    peerResponds:$('vpn-peer-responds').checked,peerPhase1Match:$('vpn-peer-p1').checked,peerPhase2Match:$('vpn-peer-p2').checked,
    phase1Up:existing?.phase1Up||false,phase2Up:existing?.phase2Up||false,lastError:'',lastChange:Date.now()
  });
  const idx=state.vpns.findIndex(v=>v.id===payload.id);if(idx>=0)state.vpns[idx]=payload;else state.vpns.push(payload);
  vpnSelectedId=payload.id;vpnEditingId=null;vpnSyncTunnel(payload);vpnSyncGeneratedObjects(payload);saveState();showView('ipsec-tunnels');vpnRender();renderAll();
}

function vpnTunnelInterface(vpn){return state.interfaces.find(i=>i.type==='IPsec Tunnel'&&i.vpnTunnelId===vpn.id)||null;}

function vpnSyncTunnel(vpn){
  let intf=vpnTunnelInterface(vpn);
  const data={...baseInterface,id:intf?.id||`vpn-if-${vpn.id}`,group:'IPsec Tunnel',name:vpn.name,type:'IPsec Tunnel',role:'Undefined',ip:'0.0.0.0',mask:'0.0.0.0',access:[],parent:vpn.interface,members:vpn.interface,createAddressObject:false,deviceDetection:false,enabled:vpn.enabled,linkStatus:vpn.phase2Up?'Up':'Down',vpnTunnelId:vpn.id,ref:intf?.ref||0};
  if(intf)state.interfaces[state.interfaces.findIndex(i=>i.id===intf.id)]=normalizeInterface(data);else state.interfaces.push(normalizeInterface(data));
}

function vpnSyncGeneratedObjects(vpn){
  state.addresses ||= [];
  const localIf=vpnFindLocalInterface(vpn.localSubnet);
  const defs=[{name:`${vpn.name}_local`,value:vpn.localSubnet,interface:localIf?.name||'any',kind:'local'},{name:`${vpn.name}_remote`,value:vpn.remoteSubnet,interface:vpn.name,kind:'remote'}];
  defs.forEach(d=>{let obj=state.addresses.find(a=>a.generatedForVpn===vpn.id&&a.vpnObjectKind===d.kind);if(!obj){obj={id:uid(),name:d.name,type:'Subnet',value:d.value,interface:d.interface,generatedForVpn:vpn.id,vpnObjectKind:d.kind};state.addresses.push(obj);}else Object.assign(obj,{name:d.name,type:'Subnet',value:d.value,interface:d.interface});});
}

function vpnSyncAll(){
  const valid=new Set(state.vpns.map(v=>v.id));
  state.interfaces=state.interfaces.filter(i=>i.type!=='IPsec Tunnel'||valid.has(i.vpnTunnelId));
  state.addresses=(state.addresses||[]).filter(a=>!a.generatedForVpn||valid.has(a.generatedForVpn));
  state.vpns.forEach(v=>{vpnSyncTunnel(v);vpnSyncGeneratedObjects(v);});
}

function vpnRender(){
  const body=$('ipsec-tunnels-body');if(!body)return;body.innerHTML='';
  state.vpns.forEach(v=>{const tr=document.createElement('tr');if(v.id===vpnSelectedId)tr.classList.add('selected');const up=v.phase1Up&&v.phase2Up;tr.innerHTML=`<td class="${up?'status-up':'status-down'}">${up?'● Up':'● Down'}</td><td><strong>${esc(v.name)}</strong></td><td>${esc(v.remoteGateway)}</td><td>${esc(v.interface)}</td><td>IKEv${esc(v.ikeVersion)} · ${esc(v.encryption)}/${esc(v.authentication)}</td><td class="${v.phase1Up?'status-up':'status-down'}">${v.phase1Up?'Up':'Down'}</td><td class="${v.phase2Up?'status-up':'status-down'}">${v.phase2Up?'Up':'Down'}</td><td>${esc(v.localSubnet)}</td><td>${esc(v.remoteSubnet)}</td>`;tr.addEventListener('click',()=>{vpnSelectedId=v.id;vpnRender();vpnButtons();});tr.addEventListener('dblclick',()=>vpnOpenWizard(v));body.append(tr);});vpnButtons();
}

function vpnButtons(){const v=vpnSelected();['vpn-edit-button','vpn-delete-button','vpn-up-button','vpn-down-button','vpn-route-button','vpn-policy-button','vpn-diagnose-button'].forEach(id=>{if($(id))$(id).disabled=!v;});if(v){$('vpn-up-button').disabled=v.phase1Up&&v.phase2Up;$('vpn-down-button').disabled=!(v.phase1Up||v.phase2Up);}}

function vpnWanCheck(vpn){
  const wan=findByName(vpn.interface);if(!wan||!vpnCoreIsInterfaceOperational(wan))return{ok:false,text:`WAN interface ${vpn.interface} is down`};
  const route=findBestRoute(vpn.remoteGateway);if(!route)return{ok:false,text:`No route to peer ${vpn.remoteGateway}`};
  if(route.interface!==vpn.interface)return{ok:false,text:`Peer route uses ${route.interface}, not ${vpn.interface}`};
  if(!vpn.peerResponds)return{ok:false,text:'Remote peer does not respond'};
  return{ok:true,text:`Peer ${vpn.remoteGateway} reachable via ${vpn.interface}`};
}

function vpnBringUp(vpn){
  const wan=vpnWanCheck(vpn);vpn.phase1Up=false;vpn.phase2Up=false;vpn.lastError='';
  if(!vpn.enabled){vpn.lastError='Tunnel is administratively disabled';vpnEvent(vpn,'error',vpn.lastError);vpnSyncTunnel(vpn);saveState();renderAll();vpnRender();return;}
  if(!wan.ok){vpn.lastError=wan.text;vpnEvent(vpn,'error',`Phase 1 failed: ${wan.text}`);vpnSyncTunnel(vpn);saveState();renderAll();vpnRender();return;}
  if(!vpn.psk||!vpn.peerPhase1Match){vpn.lastError='Phase 1 proposal/authentication mismatch';vpnEvent(vpn,'error',vpn.lastError);vpnSyncTunnel(vpn);saveState();renderAll();vpnRender();return;}
  vpn.phase1Up=true;vpnEvent(vpn,'info','Phase 1 IKE SA established');
  if(!isCIDR(vpn.localSubnet)||!isCIDR(vpn.remoteSubnet)||!vpn.peerPhase2Match){vpn.lastError='Phase 2 selector/proposal mismatch';vpnEvent(vpn,'error',vpn.lastError);vpnSyncTunnel(vpn);saveState();renderAll();vpnRender();return;}
  vpn.phase2Up=true;vpn.lastError='';vpn.lastChange=Date.now();vpnEvent(vpn,'info','Phase 2 IPsec SA established');vpnSyncTunnel(vpn);saveState();renderAll();vpnRender();
}

function vpnBringDown(vpn,reason='Tunnel down'){
  vpn.phase1Up=false;vpn.phase2Up=false;vpn.lastError=reason;vpn.lastChange=Date.now();vpnEvent(vpn,'info',reason);vpnSyncTunnel(vpn);saveState();renderAll();vpnRender();
}

function vpnCreateRoute(vpn){
  const existing=state.routes.find(r=>r.generatedForVpn===vpn.id||(!r.connected&&!r.dynamic&&r.destination===vpn.remoteSubnet&&r.interface===vpn.name));
  if(existing){alert(`Route ${vpn.remoteSubnet} via ${vpn.name} already exists.`);return;}
  state.routes.push({id:uid(),destination:vpn.remoteSubnet,destinationType:'Subnet',destinationObject:'',gateway:'0.0.0.0',interface:vpn.name,distance:10,priority:0,vrf:0,enabled:true,type:'static',dynamicGateway:false,blackhole:false,comment:`IPsec route for ${vpn.name}`,generatedForVpn:vpn.id});
  vpnEvent(vpn,'info',`Static route ${vpn.remoteSubnet} via ${vpn.name} created`);saveState();renderAll();alert(`Created route ${vpn.remoteSubnet} → ${vpn.name}`);
}

function vpnCreatePolicies(vpn){
  const localIf=vpnFindLocalInterface(vpn.localSubnet);if(!localIf){alert(`No local interface belongs to ${vpn.localSubnet}.`);return;}
  vpnSyncGeneratedObjects(vpn);const localObj=`${vpn.name}_local`,remoteObj=`${vpn.name}_remote`;
  const nextId=()=>Math.max(0,...state.policies.map(p=>Number(p.id)||0))+1;
  const add=(name,from,to,source,destination)=>{if(state.policies.some(p=>p.name===name))return false;const data={id:nextId(),uid:uid(),name,from,to,source,destination,schedule:'always',service:'ALL',action:'ACCEPT',inspectionMode:'Flow-based',nat:false,natMode:'Outgoing Interface Address',ipPool:'',protocolOptions:'default',trafficShaper:'',antivirus:false,webFilter:false,dnsFilter:false,applicationControl:false,fileFilter:false,sslInspection:'no-inspection',logTraffic:'All Sessions',comments:`Generated for ${vpn.name}; site-to-site NAT OFF`,enabled:true,generatedForVpn:vpn.id};const deny=state.policies.findIndex(p=>p.name==='Deny-ALL');state.policies.splice(deny<0?state.policies.length:deny,0,data);return true;};
  const a=add(`${vpn.name}_local-to-remote`,localIf.name,vpn.name,localObj,remoteObj);const b=add(`${vpn.name}_remote-to-local`,vpn.name,localIf.name,remoteObj,localObj);vpnEvent(vpn,'info','Firewall policies checked/created with NAT OFF');saveState();renderAll();alert(a||b?'Created site-to-site policies with NAT OFF.':'Policies already exist.');
}

function vpnDiagnose(vpn){
  const wan=vpnWanCheck(vpn);const route=state.routes.find(r=>r.enabled!==false&&r.destination===vpn.remoteSubnet&&r.interface===vpn.name);
  const localIf=vpnFindLocalInterface(vpn.localSubnet);const outPolicy=localIf&&state.policies.find(p=>p.enabled!==false&&p.from===localIf.name&&p.to===vpn.name);const inPolicy=localIf&&state.policies.find(p=>p.enabled!==false&&p.from===vpn.name&&p.to===localIf.name);
  const natOk=Boolean(outPolicy)&&!outPolicy.nat;const checks=[['WAN reachability',wan.ok,wan.text],['Phase 1',vpn.phase1Up,vpn.phase1Up?'IKE SA established':vpn.lastError||'Down'],['Phase 2',vpn.phase2Up,vpn.phase2Up?'IPsec SA established':vpn.lastError||'Down'],['Local Network',Boolean(localIf),localIf?`${vpn.localSubnet} via ${localIf.name}`:`No local interface for ${vpn.localSubnet}`],['Remote Network',isCIDR(vpn.remoteSubnet),vpn.remoteSubnet],['Route',Boolean(route),route?`${vpn.remoteSubnet} → ${vpn.name}`:'Missing static route'],['LAN → IPsec Policy',Boolean(outPolicy),outPolicy?.name||'Missing'],['IPsec → LAN Policy',Boolean(inPolicy),inPolicy?.name||'Missing'],['NAT decision',natOk,natOk?'NAT OFF':'Site-to-site policy should normally use NAT OFF']];
  openModal(`IPsec Diagnose - ${vpn.name}`,`<div class="table-wrap full-table-wrap"><table class="data-table"><thead><tr><th>Check</th><th>Status</th><th>Result</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${esc(c[0])}</td><td class="${c[1]?'status-up':'status-deny'}">${c[1]?'✓ PASS':'✕ FAIL'}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table></div><p class="muted">A tunnel can be UP while traffic still fails because of selectors, routing, policies, NAT or the return path.</p>`,[{label:'Close',className:'btn-secondary',action:closeModal}]);
}

function vpnDelete(){
  const vpn=vpnSelected();if(!vpn)return;const intf=vpnTunnelInterface(vpn);const refs=intf?getRefCount(intf):0;
  if(refs>0){alert(`Cannot delete ${vpn.name}: the tunnel interface has ${refs} route/policy reference(s). Remove them first.`);return;}
  if(!confirm(`Delete IPsec tunnel "${vpn.name}"?`))return;
  state.vpns=state.vpns.filter(v=>v.id!==vpn.id);state.interfaces=state.interfaces.filter(i=>i.vpnTunnelId!==vpn.id);state.addresses=(state.addresses||[]).filter(a=>a.generatedForVpn!==vpn.id);state.routes=state.routes.filter(r=>r.generatedForVpn!==vpn.id);vpnSelectedId=null;vpnEvent(vpn,'info','Tunnel deleted');saveState();renderAll();vpnRender();
}

function vpnFindLocalInterface(cidr){
  if(!isCIDR(cidr))return null;
  return state.interfaces.find(i=>i.type!=='IPsec Tunnel'&&i.enabled!==false&&isIPv4(i.ip)&&i.ip!=='0.0.0.0'&&cidrContains(cidr,i.ip))||null;
}

function vpnCidrsOverlap(a,b){
  if(!isCIDR(a)||!isCIDR(b))return false;const [aIp]=a.split('/'),[bIp]=b.split('/');return cidrContains(a,bIp)||cidrContains(b,aIp);
}

function vpnEvent(vpn,level,message){state.vpnEvents ||= [];state.vpnEvents.push({id:uid(),timestamp:Date.now(),tunnel:vpn.name,level,message});state.vpnEvents=state.vpnEvents.slice(-200);}

const vpnCoreIsInterfaceOperational=isInterfaceOperational;
isInterfaceOperational=function(intf){
  if(intf?.type==='IPsec Tunnel'){
    const vpn=state.vpns?.find(v=>v.id===intf.vpnTunnelId||v.name===intf.name);return Boolean(vpn&&vpn.enabled&&vpn.phase1Up&&vpn.phase2Up);
  }
  return vpnCoreIsInterfaceOperational(intf);
};

const vpnCoreEvaluateTraffic=evaluateTraffic;
evaluateTraffic=function(args){
  const incomingVpn=state.vpns?.find(v=>v.name===args.incoming);
  if(incomingVpn){
    if(!incomingVpn.phase1Up||!incomingVpn.phase2Up)return{action:'DENY',policyId:'-',reason:`IPsec tunnel ${incomingVpn.name} is down`};
    if(!cidrContains(incomingVpn.remoteSubnet,args.source))return{action:'DENY',policyId:'-',reason:`Source ${args.source} is outside remote Phase 2 selector ${incomingVpn.remoteSubnet}`};
    if(!cidrContains(incomingVpn.localSubnet,args.destination))return{action:'DENY',policyId:'-',reason:`Destination ${args.destination} is outside local Phase 2 selector ${incomingVpn.localSubnet}`};
  }
  const route=findBestRoute(args.destination);const outgoingVpn=route&&state.vpns?.find(v=>v.name===route.interface);
  if(outgoingVpn){
    if(!outgoingVpn.phase1Up||!outgoingVpn.phase2Up)return{action:'DENY',policyId:'-',reason:`IPsec tunnel ${outgoingVpn.name} is down`};
    if(!cidrContains(outgoingVpn.localSubnet,args.source))return{action:'DENY',policyId:'-',reason:`Source ${args.source} is outside local Phase 2 selector ${outgoingVpn.localSubnet}`};
    if(!cidrContains(outgoingVpn.remoteSubnet,args.destination))return{action:'DENY',policyId:'-',reason:`Destination ${args.destination} is outside remote Phase 2 selector ${outgoingVpn.remoteSubnet}`};
  }
  const result=vpnCoreEvaluateTraffic(args);
  if(result.action==='ACCEPT'&&outgoingVpn){const p=state.policies.find(x=>String(x.id)===String(result.policyId));result.reason+=p?.nat?'; WARNING: NAT is enabled on site-to-site traffic':'; NAT OFF';}
  return result;
};

const vpnCoreShowView=showView;
showView=function(name){vpnCoreShowView(name);if(name==='ipsec-tunnels'||name==='ipsec-wizard')$('nav-vpn-parent')?.classList.add('active');if(name==='ipsec-tunnels')vpnRender();};

const vpnCoreRenderAll=renderAll;
renderAll=function(){vpnSyncAll();vpnCoreRenderAll();vpnRender();};

const vpnCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim();let m;
  if(/^get vpn ipsec tunnel summary$/i.test(text)){
    cli(`FG-SIM-01 # ${text}`);if(!state.vpns.length){cli('No IPsec tunnels configured.');return;}state.vpns.forEach(v=>cli(`${v.name}: phase1=${v.phase1Up?'up':'down'} phase2=${v.phase2Up?'up':'down'} peer=${v.remoteGateway} selectors=${v.localSubnet}<->${v.remoteSubnet}`));return;
  }
  m=text.match(/^diagnose vpn tunnel list name\s+(.+)$/i);if(m){const name=m[1].replace(/^['\"]|['\"]$/g,'').trim(),v=state.vpns.find(x=>x.name===name);cli(`FG-SIM-01 # ${text}`);if(!v){cli(`Tunnel ${name} not found.`);return;}cli(`name=${v.name} ver=1 serial=1 ${v.phase1Up&&v.phase2Up?'up':'down'}\nbound_if=${v.interface} remote-gw=${v.remoteGateway}\nproxyid=${v.localSubnet}->${v.remoteSubnet}\nphase1=${v.phase1Up?'established':'down'} phase2=${v.phase2Up?'established':'down'}${v.lastError?`\nlast_error=${v.lastError}`:''}`);return;}
  m=text.match(/^show vpn ipsec phase1-interface\s+(.+)$/i);if(m){const name=m[1].replace(/^['\"]|['\"]$/g,'').trim(),v=state.vpns.find(x=>x.name===name);cli(`FG-SIM-01 # ${text}`);if(!v){cli(`Tunnel ${name} not found.`);return;}cli(`config vpn ipsec phase1-interface\n    edit "${v.name}"\n        set interface "${v.interface}"\n        set ike-version ${v.ikeVersion}\n        set remote-gw ${v.remoteGateway}\n        set proposal ${v.encryption.toLowerCase()}-${v.authentication.toLowerCase()}\n        set dhgrp ${v.dhGroup}\n    next\nend`);return;}
  m=text.match(/^show vpn ipsec phase2-interface\s+(.+)$/i);if(m){const name=m[1].replace(/^['\"]|['\"]$/g,'').trim(),v=state.vpns.find(x=>x.name===name);cli(`FG-SIM-01 # ${text}`);if(!v){cli(`Tunnel ${name} not found.`);return;}cli(`config vpn ipsec phase2-interface\n    edit "${v.name}-p2"\n        set phase1name "${v.name}"\n        set proposal ${v.phase2Encryption.toLowerCase()}-${v.phase2Authentication.toLowerCase()}\n        set src-subnet ${v.localSubnet}\n        set dst-subnet ${v.remoteSubnet}\n    next\nend`);return;}
  vpnCoreRunCli(text);
};

vpnPrepareNavigation();
vpnPrepareViews();
vpnInitState();
document.addEventListener('DOMContentLoaded',vpnBind);
