/* FortiOS 7.0-style advanced VPN management views. */
let vpmSelectedTemplateId = null;
let vpmSelectedClientId = null;

function vpmDefaultTemplates(){
  return [
    {id:'tpl-strong',name:'Site-to-Site Strong',builtin:true,ikeVersion:'2',encryption:'AES256',authentication:'SHA256',dhGroup:'14',keyLifetime:28800,phase2Encryption:'AES256',phase2Authentication:'SHA256',pfs:true,phase2DhGroup:'14',phase2Lifetime:3600,natTraversal:true,dpd:true,autoNegotiate:true,localSubnet:'192.168.1.0/24',remoteSubnet:'192.168.2.0/24'},
    {id:'tpl-branch',name:'Branch Office AES256',builtin:true,ikeVersion:'2',encryption:'AES256',authentication:'SHA256',dhGroup:'19',keyLifetime:28800,phase2Encryption:'AES256',phase2Authentication:'SHA256',pfs:true,phase2DhGroup:'19',phase2Lifetime:3600,natTraversal:true,dpd:true,autoNegotiate:true,localSubnet:'192.168.1.0/24',remoteSubnet:'10.20.0.0/24'},
    {id:'tpl-legacy',name:'Legacy Compatibility',builtin:true,ikeVersion:'1',encryption:'AES128',authentication:'SHA1',dhGroup:'5',keyLifetime:28800,phase2Encryption:'AES128',phase2Authentication:'SHA1',pfs:false,phase2DhGroup:'5',phase2Lifetime:3600,natTraversal:true,dpd:true,autoNegotiate:false,localSubnet:'192.168.1.0/24',remoteSubnet:'172.16.20.0/24'}
  ];
}

function vpmNormalizeTemplate(t){
  return {
    id:t.id||uid(),name:t.name||'Custom IPsec Template',builtin:Boolean(t.builtin),
    ikeVersion:String(t.ikeVersion||'2'),encryption:t.encryption||'AES256',authentication:t.authentication||'SHA256',
    dhGroup:String(t.dhGroup||'14'),keyLifetime:Number(t.keyLifetime||28800),
    phase2Encryption:t.phase2Encryption||'AES256',phase2Authentication:t.phase2Authentication||'SHA256',
    pfs:t.pfs!==false,phase2DhGroup:String(t.phase2DhGroup||'14'),phase2Lifetime:Number(t.phase2Lifetime||3600),
    natTraversal:t.natTraversal!==false,dpd:t.dpd!==false,autoNegotiate:t.autoNegotiate!==false,
    localSubnet:t.localSubnet||'192.168.1.0/24',remoteSubnet:t.remoteSubnet||'192.168.2.0/24'
  };
}

function vpmInitState(){
  state.vpnTemplates=(Array.isArray(state.vpnTemplates)&&state.vpnTemplates.length?state.vpnTemplates:vpmDefaultTemplates()).map(vpmNormalizeTemplate);
  state.overlayVpn={enabled:false,controller:'FG-SIM-01',mode:'Hub-and-Spoke',overlayId:1,autoDiscover:true,managedTunnelIds:[],...(state.overlayVpn||{})};
  state.overlayVpn.managedTunnelIds=Array.isArray(state.overlayVpn.managedTunnelIds)?state.overlayVpn.managedTunnelIds:[];
  saveState();
}

function vpmPrepareNavigation(){
  const sub=$('vpn-subnav');if(!sub)return;
  sub.innerHTML=`
    <button id="nav-overlay-controller-vpn" class="subnav-item" data-view="overlay-controller-vpn" type="button">Overlay Controller VPN</button>
    <button id="nav-ipsec-tunnels" class="subnav-item" data-view="ipsec-tunnels" type="button">IPsec Tunnels</button>
    <button id="nav-ipsec-wizard" class="subnav-item" data-view="ipsec-wizard" type="button">IPsec Wizard</button>
    <button id="nav-ipsec-template" class="subnav-item" data-view="ipsec-template" type="button">IPsec Tunnel Template</button>
    <button id="nav-ssl-vpn-portals" class="subnav-item" data-view="ssl-vpn-portals" type="button">SSL-VPN Portals</button>
    <button id="nav-ssl-vpn-settings" class="subnav-item" data-view="ssl-vpn-settings" type="button">SSL-VPN Settings</button>
    <button id="nav-ssl-vpn-clients" class="subnav-item" data-view="ssl-vpn-clients" type="button">SSL-VPN Clients</button>
    <button id="nav-vpn-location-map" class="subnav-item" data-view="vpn-location-map" type="button">VPN Location Map</button>`;
}

function vpmPrepareViews(){
  const main=$('main-content');if(!main)return;
  if(!$('view-overlay-controller-vpn')){
    main.insertAdjacentHTML('beforeend',`<section id="view-overlay-controller-vpn" class="app-view">
      <div id="overlay-controller-header" class="page-heading-row"><h1 id="overlay-controller-title">Overlay Controller VPN</h1></div>
      <div id="overlay-controller-toolbar" class="toolbar">
        <button id="overlay-apply-button" class="btn-primary" type="button">Apply</button>
        <button id="overlay-sync-button" class="btn-secondary" type="button">↻ Sync IPsec Tunnels</button>
        <button id="overlay-diagnose-button" class="btn-secondary" type="button">⌕ Diagnose</button>
      </div>
      <section id="overlay-settings-section" class="forti-form-section"><h2 id="overlay-settings-title">Overlay Controller Settings</h2><div id="overlay-settings-body" class="forti-form-body">
        <div id="field-overlay-enabled" class="forti-field-row"><label id="label-overlay-enabled">Status</label><div id="control-overlay-enabled"><label id="overlay-enabled-switch" class="forti-switch"><input id="overlay-enabled" type="checkbox"><span></span></label></div></div>
        <div id="field-overlay-controller" class="forti-field-row"><label id="label-overlay-controller" for="overlay-controller">Controller Name</label><div id="control-overlay-controller"><input id="overlay-controller" type="text"></div></div>
        <div id="field-overlay-mode" class="forti-field-row"><label id="label-overlay-mode" for="overlay-mode">Topology</label><div id="control-overlay-mode"><select id="overlay-mode"><option>Hub-and-Spoke</option><option>Full Mesh</option></select></div></div>
        <div id="field-overlay-id" class="forti-field-row"><label id="label-overlay-id" for="overlay-id">Overlay ID</label><div id="control-overlay-id"><input id="overlay-id" type="number" min="1" max="4094"></div></div>
        <div id="field-overlay-auto" class="forti-field-row"><label id="label-overlay-auto">Auto-discover IPsec Tunnels</label><div id="control-overlay-auto"><label id="overlay-auto-switch" class="forti-switch"><input id="overlay-auto" type="checkbox"><span></span></label></div></div>
      </div></section>
      <div id="overlay-tunnel-wrap" class="table-wrap full-table-wrap"><table id="overlay-tunnel-table" class="data-table"><thead><tr><th>Managed</th><th>Tunnel</th><th>Remote Gateway</th><th>Phase 1</th><th>Phase 2</th><th>Overlay Status</th></tr></thead><tbody id="overlay-tunnel-body"></tbody></table></div>
      <div id="overlay-help" class="muted">The overlay controller groups existing route-based IPsec tunnels. It does not replace Phase 1, Phase 2, routing or firewall policy checks.</div>
    </section>`);
  }
  if(!$('view-ipsec-template')){
    main.insertAdjacentHTML('beforeend',`<section id="view-ipsec-template" class="app-view">
      <div id="ipsec-template-header" class="page-heading-row"><h1 id="ipsec-template-title">IPsec Tunnel Template</h1></div>
      <div id="ipsec-template-toolbar" class="toolbar">
        <button id="ipsec-template-create" class="btn-primary" type="button">＋ Create New</button>
        <button id="ipsec-template-edit" class="btn-secondary" type="button" disabled>✎ Edit</button>
        <button id="ipsec-template-clone" class="btn-secondary" type="button" disabled>⧉ Clone</button>
        <button id="ipsec-template-delete" class="btn-secondary" type="button" disabled>▱ Delete</button>
        <button id="ipsec-template-use" class="btn-secondary" type="button" disabled>▶ Create Tunnel From Template</button>
      </div>
      <div id="ipsec-template-wrap" class="table-wrap full-table-wrap"><table id="ipsec-template-table" class="data-table"><thead><tr><th>Name</th><th>IKE</th><th>Phase 1 Proposal</th><th>DH</th><th>Phase 2 Proposal</th><th>PFS</th><th>Selectors</th></tr></thead><tbody id="ipsec-template-body"></tbody></table></div>
      <div id="ipsec-template-help" class="muted">Templates pre-fill the IPsec Wizard. Peer address and pre-shared key remain site-specific.</div>
    </section>`);
  }
  if(!$('view-ssl-vpn-clients')){
    main.insertAdjacentHTML('beforeend',`<section id="view-ssl-vpn-clients" class="app-view">
      <div id="ssl-vpn-clients-header" class="page-heading-row"><h1 id="ssl-vpn-clients-title">SSL-VPN Clients</h1></div>
      <div id="ssl-vpn-clients-toolbar" class="toolbar">
        <button id="ssl-clients-login" class="btn-primary" type="button">▶ Simulate Login</button>
        <button id="ssl-clients-disconnect" class="btn-secondary" type="button" disabled>Disconnect</button>
        <button id="ssl-clients-details" class="btn-secondary" type="button" disabled>▣ Details</button>
        <div id="toolbar-grow"></div>
        <input id="ssl-clients-search" class="search-input" type="search" placeholder="Search clients">
      </div>
      <div id="ssl-clients-summary" class="muted"></div>
      <div id="ssl-vpn-clients-wrap" class="table-wrap full-table-wrap"><table id="ssl-vpn-clients-table" class="data-table"><thead><tr><th>Status</th><th>User</th><th>Public IP</th><th>SSL-VPN IP</th><th>Portal</th><th>Connected</th><th>Last Activity</th><th>Traffic</th></tr></thead><tbody id="ssl-vpn-clients-body"></tbody></table></div>
    </section>`);
  }
  if(!$('view-vpn-location-map')){
    main.insertAdjacentHTML('beforeend',`<section id="view-vpn-location-map" class="app-view">
      <div id="vpn-location-header" class="page-heading-row"><h1 id="vpn-location-title">VPN Location Map</h1></div>
      <div id="vpn-location-toolbar" class="toolbar"><button id="vpn-location-refresh" class="btn-primary" type="button">↻ Refresh</button></div>
      <div id="vpn-location-summary" class="muted"></div>
      <div id="vpn-location-wrap" class="table-wrap full-table-wrap"><table id="vpn-location-table" class="data-table"><thead><tr><th>Type</th><th>Name / User</th><th>Endpoint</th><th>Simulated Location</th><th>Status</th><th>Interface / Portal</th></tr></thead><tbody id="vpn-location-body"></tbody></table></div>
      <div id="vpn-location-help" class="muted">Locations are deterministic simulator labels derived from endpoint addresses. No external geolocation service is used.</div>
    </section>`);
  }
}

function vpmTemplates(){return state.vpnTemplates||[];}
function vpmSelectedTemplate(){return vpmTemplates().find(t=>t.id===vpmSelectedTemplateId)||null;}

function vpmRenderTemplates(){
  const body=$('ipsec-template-body');if(!body)return;body.innerHTML='';
  vpmTemplates().forEach(t=>{
    const tr=document.createElement('tr');if(t.id===vpmSelectedTemplateId)tr.classList.add('selected');
    tr.innerHTML=`<td><strong>${esc(t.name)}</strong>${t.builtin?' <span class="status-chip">Built-in</span>':''}</td><td>IKEv${esc(t.ikeVersion)}</td><td>${esc(t.encryption)}/${esc(t.authentication)}</td><td>${esc(t.dhGroup)}</td><td>${esc(t.phase2Encryption)}/${esc(t.phase2Authentication)}</td><td>${t.pfs?'Enabled':'Disabled'}</td><td>${esc(t.localSubnet)} ↔ ${esc(t.remoteSubnet)}</td>`;
    tr.addEventListener('click',()=>{vpmSelectedTemplateId=t.id;vpmRenderTemplates();});
    tr.addEventListener('dblclick',()=>{if(!t.builtin)vpmOpenTemplateEditor(t);});
    body.append(tr);
  });
  const t=vpmSelectedTemplate();
  if($('ipsec-template-edit'))$('ipsec-template-edit').disabled=!t||t.builtin;
  if($('ipsec-template-clone'))$('ipsec-template-clone').disabled=!t;
  if($('ipsec-template-delete'))$('ipsec-template-delete').disabled=!t||t.builtin;
  if($('ipsec-template-use'))$('ipsec-template-use').disabled=!t;
}

function vpmTemplateEditorBody(t){
  return `<div class="form-grid">
    <div class="field"><label for="vpm-tpl-name">Name</label><input id="vpm-tpl-name" value="${esc(t.name)}" ${t.builtin?'disabled':''}></div>
    <div class="field"><label for="vpm-tpl-ike">IKE Version</label><select id="vpm-tpl-ike"><option value="2">IKEv2</option><option value="1">IKEv1</option></select></div>
    <div class="field"><label for="vpm-tpl-p1-enc">Phase 1 Encryption</label><select id="vpm-tpl-p1-enc"><option>AES256</option><option>AES128</option><option>3DES</option></select></div>
    <div class="field"><label for="vpm-tpl-p1-auth">Phase 1 Authentication</label><select id="vpm-tpl-p1-auth"><option>SHA256</option><option>SHA1</option></select></div>
    <div class="field"><label for="vpm-tpl-dh">DH Group</label><select id="vpm-tpl-dh"><option>14</option><option>19</option><option>20</option><option>5</option></select></div>
    <div class="field"><label for="vpm-tpl-p1-life">Phase 1 Lifetime</label><input id="vpm-tpl-p1-life" type="number" min="120" value="${t.keyLifetime}"></div>
    <div class="field"><label for="vpm-tpl-p2-enc">Phase 2 Encryption</label><select id="vpm-tpl-p2-enc"><option>AES256</option><option>AES128</option><option>3DES</option></select></div>
    <div class="field"><label for="vpm-tpl-p2-auth">Phase 2 Authentication</label><select id="vpm-tpl-p2-auth"><option>SHA256</option><option>SHA1</option></select></div>
    <div class="field"><label for="vpm-tpl-p2-dh">Phase 2 DH Group</label><select id="vpm-tpl-p2-dh"><option>14</option><option>19</option><option>20</option><option>5</option></select></div>
    <div class="field"><label for="vpm-tpl-p2-life">Phase 2 Lifetime</label><input id="vpm-tpl-p2-life" type="number" min="120" value="${t.phase2Lifetime}"></div>
    <div class="field"><label>PFS</label><label class="forti-switch"><input id="vpm-tpl-pfs" type="checkbox" ${t.pfs?'checked':''}><span></span></label></div>
    <div class="field"><label>NAT Traversal</label><label class="forti-switch"><input id="vpm-tpl-natt" type="checkbox" ${t.natTraversal?'checked':''}><span></span></label></div>
    <div class="field"><label>DPD</label><label class="forti-switch"><input id="vpm-tpl-dpd" type="checkbox" ${t.dpd?'checked':''}><span></span></label></div>
    <div class="field"><label>Auto-negotiate</label><label class="forti-switch"><input id="vpm-tpl-auto" type="checkbox" ${t.autoNegotiate?'checked':''}><span></span></label></div>
    <div class="field"><label for="vpm-tpl-local">Local Selector</label><input id="vpm-tpl-local" value="${esc(t.localSubnet)}"></div>
    <div class="field"><label for="vpm-tpl-remote">Remote Selector</label><input id="vpm-tpl-remote" value="${esc(t.remoteSubnet)}"></div>
    <div class="field full"><div id="vpm-tpl-error" class="muted"></div></div>
  </div>`;
}

function vpmOpenTemplateEditor(template=null){
  const t=template?vpmNormalizeTemplate(template):vpmNormalizeTemplate({name:'Custom IPsec Template',builtin:false});
  openModal(template?'Edit IPsec Tunnel Template':'Create IPsec Tunnel Template',vpmTemplateEditorBody(t),[
    {label:'Cancel',className:'btn-secondary',action:closeModal},
    {label:template?'OK':'Create',className:'btn-primary',action:()=>vpmSaveTemplate(template?.id||null)}
  ]);
  $('vpm-tpl-ike').value=t.ikeVersion;$('vpm-tpl-p1-enc').value=t.encryption;$('vpm-tpl-p1-auth').value=t.authentication;$('vpm-tpl-dh').value=t.dhGroup;
  $('vpm-tpl-p2-enc').value=t.phase2Encryption;$('vpm-tpl-p2-auth').value=t.phase2Authentication;$('vpm-tpl-p2-dh').value=t.phase2DhGroup;
}

function vpmSaveTemplate(id){
  const old=vpmTemplates().find(t=>t.id===id)||null,name=(old?.builtin?old.name:$('vpm-tpl-name').value.trim());
  const errors=[],local=$('vpm-tpl-local').value.trim(),remote=$('vpm-tpl-remote').value.trim();
  if(!name)errors.push('Template name is required.');
  if(!old&&vpmTemplates().some(t=>t.name.toLowerCase()===name.toLowerCase()))errors.push('Template name already exists.');
  if(!isCIDR(local)||!isCIDR(remote))errors.push('Local and Remote selectors must be valid CIDRs.');
  const p1=Number($('vpm-tpl-p1-life').value),p2=Number($('vpm-tpl-p2-life').value);
  if(!Number.isInteger(p1)||p1<120)errors.push('Phase 1 lifetime is invalid.');
  if(!Number.isInteger(p2)||p2<120)errors.push('Phase 2 lifetime is invalid.');
  if(errors.length){$('vpm-tpl-error').textContent=errors.join(' • ');return;}
  const data=vpmNormalizeTemplate({id:old?.id||uid(),name,builtin:old?.builtin||false,ikeVersion:$('vpm-tpl-ike').value,encryption:$('vpm-tpl-p1-enc').value,authentication:$('vpm-tpl-p1-auth').value,dhGroup:$('vpm-tpl-dh').value,keyLifetime:p1,phase2Encryption:$('vpm-tpl-p2-enc').value,phase2Authentication:$('vpm-tpl-p2-auth').value,pfs:$('vpm-tpl-pfs').checked,phase2DhGroup:$('vpm-tpl-p2-dh').value,phase2Lifetime:p2,natTraversal:$('vpm-tpl-natt').checked,dpd:$('vpm-tpl-dpd').checked,autoNegotiate:$('vpm-tpl-auto').checked,localSubnet:local,remoteSubnet:remote});
  const idx=vpmTemplates().findIndex(t=>t.id===data.id);if(idx>=0)state.vpnTemplates[idx]=data;else state.vpnTemplates.push(data);
  vpmSelectedTemplateId=data.id;saveState();closeModal();vpmRenderTemplates();
}

function vpmCloneTemplate(){
  const t=vpmSelectedTemplate();if(!t)return;const c=structuredClone(t);c.id=uid();c.builtin=false;let base=`${t.name}_copy`,n=2;c.name=base;while(vpmTemplates().some(x=>x.name===c.name))c.name=`${base}_${n++}`;
  state.vpnTemplates.push(c);vpmSelectedTemplateId=c.id;saveState();vpmRenderTemplates();
}
function vpmDeleteTemplate(){
  const t=vpmSelectedTemplate();if(!t||t.builtin)return;
  if(confirm(`Delete IPsec template "${t.name}"?`)){state.vpnTemplates=vpmTemplates().filter(x=>x.id!==t.id);vpmSelectedTemplateId=null;saveState();vpmRenderTemplates();}
}

function vpmUseTemplate(){
  const t=vpmSelectedTemplate();if(!t)return;
  vpnOpenWizard();
  $('vpn-name').value='template-tunnel';
  $('vpn-ike').value=t.ikeVersion;$('vpn-encryption').value=t.encryption;$('vpn-authentication').value=t.authentication;$('vpn-dh').value=t.dhGroup;$('vpn-p1-lifetime').value=String(t.keyLifetime);
  $('vpn-nat-t').checked=t.natTraversal;$('vpn-dpd').checked=t.dpd;$('vpn-local').value=t.localSubnet;$('vpn-remote').value=t.remoteSubnet;
  $('vpn-p2-encryption').value=t.phase2Encryption;$('vpn-p2-authentication').value=t.phase2Authentication;$('vpn-pfs').checked=t.pfs;$('vpn-p2-dh').value=t.phase2DhGroup;$('vpn-p2-lifetime').value=String(t.phase2Lifetime);$('vpn-auto-negotiate').checked=t.autoNegotiate;
  $('vpn-editor-errors').textContent=`Template loaded: ${t.name}. Set Remote Gateway and matching Pre-shared Key.`;
}

function vpmRenderOverlay(){
  const s=state.overlayVpn;if(!$('overlay-tunnel-body'))return;
  $('overlay-enabled').checked=Boolean(s.enabled);$('overlay-controller').value=s.controller||'FG-SIM-01';$('overlay-mode').value=s.mode||'Hub-and-Spoke';$('overlay-id').value=String(s.overlayId||1);$('overlay-auto').checked=s.autoDiscover!==false;
  const body=$('overlay-tunnel-body');body.innerHTML='';
  (state.vpns||[]).forEach(v=>{
    const managed=s.managedTunnelIds.includes(v.id),up=v.phase1Up&&v.phase2Up,tr=document.createElement('tr');
    tr.innerHTML=`<td>${managed?'✓ Managed':'—'}</td><td><strong>${esc(v.name)}</strong></td><td>${esc(v.remoteGateway)}</td><td class="${v.phase1Up?'status-up':'status-down'}">${v.phase1Up?'Up':'Down'}</td><td class="${v.phase2Up?'status-up':'status-down'}">${v.phase2Up?'Up':'Down'}</td><td class="${managed&&up?'status-up':'status-down'}">${!managed?'Not joined':up?'Healthy':'Tunnel down'}</td>`;
    body.append(tr);
  });
}
function vpmSaveOverlay(){
  const controller=$('overlay-controller').value.trim(),overlayId=Number($('overlay-id').value);
  if(!controller){alert('Controller Name is required.');return;}
  if(!Number.isInteger(overlayId)||overlayId<1||overlayId>4094){alert('Overlay ID must be 1-4094.');return;}
  Object.assign(state.overlayVpn,{enabled:$('overlay-enabled').checked,controller,mode:$('overlay-mode').value,overlayId,autoDiscover:$('overlay-auto').checked});
  if(state.overlayVpn.autoDiscover)state.overlayVpn.managedTunnelIds=(state.vpns||[]).map(v=>v.id);
  saveState();vpmRenderOverlay();
}
function vpmSyncOverlay(){state.overlayVpn.managedTunnelIds=(state.vpns||[]).map(v=>v.id);saveState();vpmRenderOverlay();}
function vpmDiagnoseOverlay(){
  const s=state.overlayVpn,tunnels=state.vpns||[],managed=tunnels.filter(v=>s.managedTunnelIds.includes(v.id)),up=managed.filter(v=>v.phase1Up&&v.phase2Up);
  const checks=[['Controller enabled',s.enabled,s.enabled?'Enabled':'Disabled'],['Managed tunnels',managed.length>0,`${managed.length} tunnel(s)`],['Healthy tunnels',managed.length>0&&up.length===managed.length,`${up.length}/${managed.length} up`],['Overlay ID',Number(s.overlayId)>0,String(s.overlayId)],['Controller name',Boolean(s.controller),s.controller||'Missing']];
  openModal('Overlay Controller Diagnose',`<div class="table-wrap full-table-wrap"><table class="data-table"><thead><tr><th>Check</th><th>Status</th><th>Result</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${esc(c[0])}</td><td class="${c[1]?'status-up':'status-deny'}">${c[1]?'✓ PASS':'✕ FAIL'}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table></div>`,[{label:'Close',className:'btn-secondary',action:closeModal}]);
}

function vpmAllClients(){
  const q=$('ssl-clients-search')?.value.trim().toLowerCase()||'';
  return [...(state.sslVpn?.sessions||[])].sort((a,b)=>Number(b.connectedAt||0)-Number(a.connectedAt||0)).filter(s=>!q||[s.username,s.sourceIp,s.clientIp,s.portal].join(' ').toLowerCase().includes(q));
}
function vpmRenderClients(){
  const body=$('ssl-vpn-clients-body');if(!body)return;body.innerHTML='';
  const sessions=vpmAllClients();
  sessions.forEach(s=>{
    const active=s.active!==false,tr=document.createElement('tr');if(s.id===vpmSelectedClientId)tr.classList.add('selected');
    tr.innerHTML=`<td class="${active?'status-up':'status-down'}">${active?'● Connected':'● Disconnected'}</td><td><strong>${esc(s.username)}</strong></td><td>${esc(s.sourceIp)}</td><td>${esc(s.clientIp)}</td><td>${esc(s.portal)}</td><td>${new Date(s.connectedAt).toLocaleString()}</td><td>${s.lastActivity?new Date(s.lastActivity).toLocaleTimeString():'—'}</td><td>${formatBytes(Number(s.bytesOut)||0)} / ${formatBytes(Number(s.bytesIn)||0)}</td>`;
    tr.addEventListener('click',()=>{vpmSelectedClientId=s.id;vpmRenderClients();});tr.addEventListener('dblclick',()=>vpmClientDetails(s));body.append(tr);
  });
  const selected=(state.sslVpn?.sessions||[]).find(s=>s.id===vpmSelectedClientId)||null;
  if($('ssl-clients-disconnect'))$('ssl-clients-disconnect').disabled=!selected||selected.active===false;
  if($('ssl-clients-details'))$('ssl-clients-details').disabled=!selected;
  const active=(state.sslVpn?.sessions||[]).filter(s=>s.active!==false);
  if($('ssl-clients-summary'))$('ssl-clients-summary').textContent=`${active.length} active · ${(state.sslVpn?.sessions||[]).length} total session record(s) · pool ${sslVpnSettings().clientPool}`;
}
function vpmClientDetails(session){
  const portal=sslVpnPortalByName(session.portal),active=session.active!==false;
  openModal(`SSL-VPN Client - ${session.username}`,`<dl class="forti-log-detail-grid"><dt>Status</dt><dd>${active?'Connected':'Disconnected'}</dd><dt>User</dt><dd>${esc(session.username)}</dd><dt>Group</dt><dd>${esc(session.group||'—')}</dd><dt>Public Source IP</dt><dd>${esc(session.sourceIp)}</dd><dt>SSL-VPN IP</dt><dd>${esc(session.clientIp)}</dd><dt>Portal</dt><dd>${esc(session.portal)}</dd><dt>Tunnel Mode</dt><dd>${portal?.tunnelMode?'Enabled':'Disabled'}</dd><dt>Split Tunnel</dt><dd>${portal?.splitTunnel?'Enabled':'Disabled'}</dd><dt>Connected</dt><dd>${new Date(session.connectedAt).toLocaleString()}</dd><dt>Traffic</dt><dd>${formatBytes(Number(session.bytesOut)||0)} sent / ${formatBytes(Number(session.bytesIn)||0)} received</dd></dl>`,[{label:'Close',className:'btn-secondary',action:closeModal}]);
}
function vpmDisconnectClient(){
  const s=(state.sslVpn?.sessions||[]).find(x=>x.id===vpmSelectedClientId&&x.active!==false);if(!s)return;
  s.active=false;s.disconnectedAt=Date.now();if(typeof sslVpnEvent==='function')sslVpnEvent('logout',`${s.username} disconnected from SSL-VPN Clients`);
  saveState();vpmRenderClients();if(typeof sslVpnRenderSettings==='function')sslVpnRenderSettings();
}

function vpmLocation(ip){
  if(!isIPv4(ip))return 'Unknown';
  if(/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip))return 'Internal / Private';
  const labels=['Tel Aviv, Israel','London, United Kingdom','Frankfurt, Germany','New York, USA','Singapore','Toronto, Canada','Sydney, Australia','Paris, France'];
  return labels[ipToInt(ip)%labels.length];
}
function vpmRenderLocationMap(){
  const body=$('vpn-location-body');if(!body)return;body.innerHTML='';
  let count=0,up=0;
  (state.vpns||[]).forEach(v=>{const healthy=v.phase1Up&&v.phase2Up,tr=document.createElement('tr');count++;if(healthy)up++;tr.innerHTML=`<td>IPsec</td><td><strong>${esc(v.name)}</strong></td><td>${esc(v.remoteGateway)}</td><td>${esc(vpmLocation(v.remoteGateway))}</td><td class="${healthy?'status-up':'status-down'}">${healthy?'● Up':'● Down'}</td><td>${esc(v.interface)}</td>`;body.append(tr);});
  (state.sslVpn?.sessions||[]).forEach(s=>{const active=s.active!==false,tr=document.createElement('tr');count++;if(active)up++;tr.innerHTML=`<td>SSL-VPN</td><td><strong>${esc(s.username)}</strong></td><td>${esc(s.sourceIp)}</td><td>${esc(vpmLocation(s.sourceIp))}</td><td class="${active?'status-up':'status-down'}">${active?'● Connected':'● Disconnected'}</td><td>${esc(s.portal)}</td>`;body.append(tr);});
  if($('vpn-location-summary'))$('vpn-location-summary').textContent=`${count} VPN endpoint(s) · ${up} currently active`;
}

function vpmBind(){
  $('nav-ipsec-wizard')?.addEventListener('click',()=>vpnOpenWizard());
  $('ipsec-template-create')?.addEventListener('click',()=>vpmOpenTemplateEditor());
  $('ipsec-template-edit')?.addEventListener('click',()=>{const t=vpmSelectedTemplate();if(t&&!t.builtin)vpmOpenTemplateEditor(t);});
  $('ipsec-template-clone')?.addEventListener('click',vpmCloneTemplate);
  $('ipsec-template-delete')?.addEventListener('click',vpmDeleteTemplate);
  $('ipsec-template-use')?.addEventListener('click',vpmUseTemplate);
  $('overlay-apply-button')?.addEventListener('click',vpmSaveOverlay);
  $('overlay-sync-button')?.addEventListener('click',vpmSyncOverlay);
  $('overlay-diagnose-button')?.addEventListener('click',vpmDiagnoseOverlay);
  $('ssl-clients-login')?.addEventListener('click',sslVpnOpenLogin);
  $('ssl-clients-disconnect')?.addEventListener('click',vpmDisconnectClient);
  $('ssl-clients-details')?.addEventListener('click',()=>{const s=(state.sslVpn?.sessions||[]).find(x=>x.id===vpmSelectedClientId);if(s)vpmClientDetails(s);});
  $('ssl-clients-search')?.addEventListener('input',vpmRenderClients);
  $('vpn-location-refresh')?.addEventListener('click',vpmRenderLocationMap);
}

const vpmCoreShowView=showView;
showView=function(name){
  vpmCoreShowView(name);
  if(['overlay-controller-vpn','ipsec-template','ssl-vpn-clients','vpn-location-map','ipsec-wizard'].includes(name)){
    $('nav-vpn-parent')?.classList.add('active');
    if(name==='overlay-controller-vpn')vpmRenderOverlay();
    if(name==='ipsec-template')vpmRenderTemplates();
    if(name==='ssl-vpn-clients')vpmRenderClients();
    if(name==='vpn-location-map')vpmRenderLocationMap();
  }
};

const vpmCoreRenderAll=renderAll;
renderAll=function(){vpmCoreRenderAll();vpmRenderOverlay();vpmRenderTemplates();vpmRenderClients();vpmRenderLocationMap();};

if(typeof sslVpnLogin==='function'){
  const vpmCoreSslVpnLogin=sslVpnLogin;
  sslVpnLogin=function(){const before=(state.sslVpn?.sessions||[]).length;vpmCoreSslVpnLogin();if((state.sslVpn?.sessions||[]).length>before)vpmRenderClients();};
}

const vpmCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim(),lower=text.toLowerCase();
  if(lower==='show vpn ipsec template'){
    cli(`FG-SIM-01 # ${text}`);cli(vpmTemplates().map(t=>`${t.name}: IKEv${t.ikeVersion} ${t.encryption}/${t.authentication} DH${t.dhGroup} | P2 ${t.phase2Encryption}/${t.phase2Authentication} PFS=${t.pfs?'enable':'disable'}`).join('\n')||'No IPsec templates.');return;
  }
  if(lower==='get vpn ssl client'||lower==='diagnose vpn ssl client list'){
    cli(`FG-SIM-01 # ${text}`);const list=state.sslVpn?.sessions||[];cli(list.length?list.map(s=>`${s.active!==false?'up':'down'} user=${s.username} source=${s.sourceIp} tunnel-ip=${s.clientIp} portal=${s.portal}`).join('\n'):'No SSL-VPN clients.');return;
  }
  if(lower==='get vpn overlay-controller summary'){
    const s=state.overlayVpn,managed=(state.vpns||[]).filter(v=>s.managedTunnelIds.includes(v.id)),up=managed.filter(v=>v.phase1Up&&v.phase2Up);
    cli(`FG-SIM-01 # ${text}`);cli(`status=${s.enabled?'enabled':'disabled'} controller=${s.controller} mode=${s.mode} overlay-id=${s.overlayId} tunnels=${up.length}/${managed.length} up`);return;
  }
  if(lower==='diagnose vpn location-map'){
    cli(`FG-SIM-01 # ${text}`);const lines=[];(state.vpns||[]).forEach(v=>lines.push(`IPsec ${v.name} ${v.remoteGateway} ${vpmLocation(v.remoteGateway)} ${v.phase1Up&&v.phase2Up?'up':'down'}`));(state.sslVpn?.sessions||[]).forEach(s=>lines.push(`SSL-VPN ${s.username} ${s.sourceIp} ${vpmLocation(s.sourceIp)} ${s.active!==false?'connected':'disconnected'}`));cli(lines.join('\n')||'No VPN endpoints.');return;
  }
  vpmCoreRunCli(text);
};

vpmPrepareNavigation();
vpmPrepareViews();
vpmInitState();
document.addEventListener('DOMContentLoaded',()=>{vpmBind();vpmRenderOverlay();vpmRenderTemplates();vpmRenderClients();vpmRenderLocationMap();});
