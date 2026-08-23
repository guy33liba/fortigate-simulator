/* FortiOS 7.0-style SSL-VPN remote-access simulator. */
let sslVpnSelectedPortalId = null;
let sslVpnSelectedSessionId = null;
let sslVpnLastContext = null;

function sslVpnDefaults(){
  return {
    enabled:true,
    listenInterface:'wan',
    listenPort:443,
    serverCertificate:'Fortinet_Factory',
    clientPool:'10.212.134.0/24',
    dnsMode:'Same as System DNS',
    dns1:'8.8.8.8',
    dns2:'1.1.1.1',
    idleTimeout:300,
    authTimeout:28800,
    sourceAddress:'all',
    authGroup:'SSLVPN_Users',
    authPortal:'full-access',
    requireClientCertificate:false
  };
}

function sslVpnDefaultPortals(){
  return [
    {id:'ssl-portal-full',name:'full-access',builtin:true,tunnelMode:true,webMode:true,splitTunnel:false,splitRoutes:['0.0.0.0/0'],allowBookmarks:true,message:'Full tunnel access'},
    {id:'ssl-portal-tunnel',name:'tunnel-access',builtin:true,tunnelMode:true,webMode:false,splitTunnel:true,splitRoutes:['192.168.1.0/24','192.168.20.0/24'],allowBookmarks:false,message:'Split tunnel access'},
    {id:'ssl-portal-web',name:'web-access',builtin:true,tunnelMode:false,webMode:true,splitTunnel:true,splitRoutes:[],allowBookmarks:true,message:'Web portal only'}
  ];
}

function sslVpnNormalizePortal(p){
  return {
    id:p.id||uid(),
    name:p.name||'custom-portal',
    builtin:Boolean(p.builtin),
    tunnelMode:p.tunnelMode!==false,
    webMode:Boolean(p.webMode),
    splitTunnel:Boolean(p.splitTunnel),
    splitRoutes:Array.isArray(p.splitRoutes)?p.splitRoutes:[],
    allowBookmarks:p.allowBookmarks!==false,
    message:p.message||''
  };
}

function sslVpnInitState(){
  state.sslVpn ||= {};
  state.sslVpn.settings={...sslVpnDefaults(),...(state.sslVpn.settings||{})};
  state.sslVpn.portals=(Array.isArray(state.sslVpn.portals)&&state.sslVpn.portals.length?state.sslVpn.portals:sslVpnDefaultPortals()).map(sslVpnNormalizePortal);
  state.sslVpn.sessions=Array.isArray(state.sslVpn.sessions)?state.sslVpn.sessions:[];
  state.sslVpn.events=Array.isArray(state.sslVpn.events)?state.sslVpn.events:[];
  if(!state.sslVpn.portals.some(p=>p.name===state.sslVpn.settings.authPortal))state.sslVpn.settings.authPortal=state.sslVpn.portals[0]?.name||'full-access';
  sslVpnSyncInfrastructure();
  saveState();
}

function sslVpnPrepareNavigation(){
  const sub=$('vpn-subnav');if(!sub)return;
  /* Match the FortiOS 7 VPN menu shown in the reference: tunnel list + SSL-VPN settings + portals. */
  sub.innerHTML=`
    <button id="nav-ipsec-tunnels" class="subnav-item" data-view="ipsec-tunnels" type="button">IPsec Tunnels</button>
    <button id="nav-ssl-vpn-settings" class="subnav-item" data-view="ssl-vpn-settings" type="button">SSL-VPN Settings</button>
    <button id="nav-ssl-vpn-portals" class="subnav-item" data-view="ssl-vpn-portals" type="button">SSL-VPN Portals</button>`;
}

function sslVpnPrepareViews(){
  const main=$('main-content');if(!main)return;
  if(!$('view-ssl-vpn-settings')){
    main.insertAdjacentHTML('beforeend',`
      <section id="view-ssl-vpn-settings" class="app-view">
        <div id="ssl-vpn-settings-header" class="page-heading-row"><h1 id="ssl-vpn-settings-title">SSL-VPN Settings</h1></div>
        <form id="ssl-vpn-settings-form" novalidate>
          <div id="ssl-vpn-settings-toolbar" class="toolbar">
            <button id="ssl-vpn-apply-button" type="submit" class="btn-primary">Apply</button>
            <button id="ssl-vpn-create-policy-button" type="button" class="btn-secondary">＋ Create Policies</button>
            <button id="ssl-vpn-diagnose-button" type="button" class="btn-secondary">⌕ Diagnose</button>
          </div>

          <section id="ssl-vpn-listen-section" class="forti-form-section">
            <h2 id="ssl-vpn-listen-title">SSL-VPN Settings</h2>
            <div id="ssl-vpn-listen-body" class="forti-form-body">
              <div id="field-ssl-vpn-status" class="forti-field-row"><label id="label-ssl-vpn-status">Status</label><div id="control-ssl-vpn-status"><label id="ssl-vpn-status-switch" class="forti-switch"><input id="ssl-vpn-enabled" type="checkbox"><span></span></label></div></div>
              <div id="field-ssl-vpn-interface" class="forti-field-row"><label id="label-ssl-vpn-interface" for="ssl-vpn-interface">Listen on Interface(s)</label><div id="control-ssl-vpn-interface"><select id="ssl-vpn-interface"></select></div></div>
              <div id="field-ssl-vpn-port" class="forti-field-row"><label id="label-ssl-vpn-port" for="ssl-vpn-port">Listen on Port</label><div id="control-ssl-vpn-port"><input id="ssl-vpn-port" type="number" min="1" max="65535" value="443"></div></div>
              <div id="field-ssl-vpn-cert" class="forti-field-row"><label id="label-ssl-vpn-cert" for="ssl-vpn-cert">Server Certificate</label><div id="control-ssl-vpn-cert"><select id="ssl-vpn-cert"><option>Fortinet_Factory</option><option>Fortinet_GUI_Server</option><option>Lab_Certificate</option></select></div></div>
              <div id="field-ssl-vpn-client-cert" class="forti-field-row"><label id="label-ssl-vpn-client-cert">Require Client Certificate</label><div id="control-ssl-vpn-client-cert"><label id="ssl-vpn-client-cert-switch" class="forti-switch"><input id="ssl-vpn-client-cert" type="checkbox"><span></span></label></div></div>
              <div id="field-ssl-vpn-pool" class="forti-field-row"><label id="label-ssl-vpn-pool" for="ssl-vpn-pool">Client Address Range</label><div id="control-ssl-vpn-pool"><input id="ssl-vpn-pool" type="text" value="10.212.134.0/24"></div></div>
              <div id="field-ssl-vpn-source" class="forti-field-row"><label id="label-ssl-vpn-source" for="ssl-vpn-source">Restrict Access</label><div id="control-ssl-vpn-source"><input id="ssl-vpn-source" type="text" value="all"></div></div>
            </div>
          </section>

          <section id="ssl-vpn-dns-section" class="forti-form-section">
            <h2 id="ssl-vpn-dns-title">DNS / Timeouts</h2>
            <div id="ssl-vpn-dns-body" class="forti-form-body">
              <div id="field-ssl-vpn-dns-mode" class="forti-field-row"><label id="label-ssl-vpn-dns-mode" for="ssl-vpn-dns-mode">DNS Server</label><div id="control-ssl-vpn-dns-mode"><select id="ssl-vpn-dns-mode"><option>Same as System DNS</option><option>Specify</option></select></div></div>
              <div id="field-ssl-vpn-dns-custom" class="forti-field-row"><label id="label-ssl-vpn-dns-custom">Custom DNS</label><div id="control-ssl-vpn-dns-custom" class="inline-controls"><input id="ssl-vpn-dns1" type="text" placeholder="8.8.8.8"><input id="ssl-vpn-dns2" type="text" placeholder="1.1.1.1"></div></div>
              <div id="field-ssl-vpn-idle" class="forti-field-row"><label id="label-ssl-vpn-idle" for="ssl-vpn-idle">Idle Timeout</label><div id="control-ssl-vpn-idle" class="inline-controls"><input id="ssl-vpn-idle" type="number" min="60" max="86400"><span>seconds</span></div></div>
              <div id="field-ssl-vpn-auth-timeout" class="forti-field-row"><label id="label-ssl-vpn-auth-timeout" for="ssl-vpn-auth-timeout">Authentication Timeout</label><div id="control-ssl-vpn-auth-timeout" class="inline-controls"><input id="ssl-vpn-auth-timeout" type="number" min="60" max="604800"><span>seconds</span></div></div>
            </div>
          </section>

          <section id="ssl-vpn-auth-section" class="forti-form-section">
            <h2 id="ssl-vpn-auth-title">Authentication / Portal Mapping</h2>
            <div id="ssl-vpn-auth-body" class="forti-form-body">
              <div id="field-ssl-vpn-group" class="forti-field-row"><label id="label-ssl-vpn-group" for="ssl-vpn-group">User/Groups</label><div id="control-ssl-vpn-group"><input id="ssl-vpn-group" type="text" value="SSLVPN_Users"></div></div>
              <div id="field-ssl-vpn-portal" class="forti-field-row"><label id="label-ssl-vpn-portal" for="ssl-vpn-portal">Portal</label><div id="control-ssl-vpn-portal"><select id="ssl-vpn-portal"></select></div></div>
            </div>
          </section>
          <div id="ssl-vpn-settings-errors" role="alert" aria-live="polite"></div>
        </form>

        <section id="ssl-vpn-sessions-section" class="forti-form-section">
          <h2 id="ssl-vpn-sessions-title">Active SSL-VPN Sessions</h2>
          <div id="ssl-vpn-sessions-toolbar" class="toolbar">
            <button id="ssl-vpn-login-button" type="button" class="btn-primary">▶ Simulate Login</button>
            <button id="ssl-vpn-disconnect-button" type="button" class="btn-secondary" disabled>Disconnect</button>
          </div>
          <div id="ssl-vpn-session-status" class="muted"></div>
          <div id="ssl-vpn-sessions-wrap" class="table-wrap full-table-wrap">
            <table id="ssl-vpn-sessions-table" class="data-table"><thead><tr><th>User</th><th>Source IP</th><th>Client IP</th><th>Portal</th><th>Mode</th><th>Login Time</th><th>Traffic</th></tr></thead><tbody id="ssl-vpn-sessions-body"></tbody></table>
          </div>
        </section>
      </section>`);
  }

  if(!$('view-ssl-vpn-portals')){
    main.insertAdjacentHTML('beforeend',`
      <section id="view-ssl-vpn-portals" class="app-view">
        <div id="ssl-vpn-portals-header" class="page-heading-row"><h1 id="ssl-vpn-portals-title">SSL-VPN Portals</h1></div>
        <div id="ssl-vpn-portals-toolbar" class="toolbar">
          <button id="ssl-vpn-portal-create-button" class="btn-primary">＋ Create New</button>
          <button id="ssl-vpn-portal-edit-button" class="btn-secondary" disabled>✎ Edit</button>
          <button id="ssl-vpn-portal-clone-button" class="btn-secondary" disabled>⧉ Clone</button>
          <button id="ssl-vpn-portal-delete-button" class="btn-secondary" disabled>▱ Delete</button>
        </div>
        <div id="ssl-vpn-portals-wrap" class="table-wrap full-table-wrap">
          <table id="ssl-vpn-portals-table" class="data-table"><thead><tr><th>Name</th><th>Tunnel Mode</th><th>Web Mode</th><th>Split Tunneling</th><th>Routing Addresses</th><th>Ref.</th></tr></thead><tbody id="ssl-vpn-portals-body"></tbody></table>
        </div>
        <div id="ssl-vpn-portals-help" class="muted">Full tunnel sends 0.0.0.0/0 through SSL-VPN. Split tunnel sends only the configured private networks through the VPN.</div>
      </section>`);
  }
}

function sslVpnSettings(){return state.sslVpn.settings;}
function sslVpnPortals(){return state.sslVpn.portals;}
function sslVpnPortalByName(name){return sslVpnPortals().find(p=>p.name===name)||null;}
function sslVpnActiveSessions(){return state.sslVpn.sessions.filter(s=>s.active!==false);}

function sslVpnSyncInfrastructure(){
  const s=sslVpnSettings();
  let intf=state.interfaces.find(i=>i.name==='ssl.root'||i.type==='SSL VPN');
  const data={...baseInterface,id:intf?.id||'if-ssl-root',group:'SSL VPN',name:'ssl.root',type:'SSL VPN',role:'Undefined',ip:'0.0.0.0',mask:'0.0.0.0',access:[],members:s.listenInterface,parent:s.listenInterface,createAddressObject:false,deviceDetection:false,enabled:s.enabled,linkStatus:s.enabled?'Up':'Down',sslVpnManaged:true};
  if(intf)state.interfaces[state.interfaces.findIndex(i=>i.id===intf.id)]=normalizeInterface(data);else state.interfaces.push(normalizeInterface(data));

  state.routes=state.routes.filter(r=>!r.generatedForSslVpn);
  if(s.enabled&&isCIDR(s.clientPool)){
    state.routes.push({id:'ssl-vpn-pool-route',destination:s.clientPool,gateway:'0.0.0.0',interface:'ssl.root',distance:0,priority:0,enabled:true,dynamic:true,type:'ssl-vpn',generatedForSslVpn:true});
  }

  state.addresses ||= [];
  let poolObj=state.addresses.find(a=>a.generatedForSslVpn);
  if(!poolObj){
    poolObj={id:uid(),name:'SSLVPN_TUNNEL_ADDR',type:'Subnet',value:s.clientPool,interface:'ssl.root',generatedForSslVpn:true};
    state.addresses.push(poolObj);
  }else Object.assign(poolObj,{name:'SSLVPN_TUNNEL_ADDR',type:'Subnet',value:s.clientPool,interface:'ssl.root'});

  state.sslVpn.sessions.forEach(session=>{
    if(session.active!==false&&(!isCIDR(s.clientPool)||!cidrContains(s.clientPool,session.clientIp)))session.active=false;
  });
}

function sslVpnPopulateSettings(){
  const s=sslVpnSettings();
  const ifSelect=$('ssl-vpn-interface');
  if(ifSelect){
    const candidates=state.interfaces.filter(i=>i.name!=='ssl.root'&&i.type!=='IPsec Tunnel'&&i.enabled!==false);
    ifSelect.innerHTML=candidates.map(i=>`<option value="${esc(i.name)}">${esc(i.name)}${i.role?` (${esc(i.role)})`:''}</option>`).join('');
    if(candidates.some(i=>i.name===s.listenInterface))ifSelect.value=s.listenInterface;
  }
  const portalSelect=$('ssl-vpn-portal');
  if(portalSelect){
    portalSelect.innerHTML=sslVpnPortals().map(p=>`<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
    portalSelect.value=sslVpnPortalByName(s.authPortal)?s.authPortal:(sslVpnPortals()[0]?.name||'');
  }
  if($('ssl-vpn-enabled'))$('ssl-vpn-enabled').checked=s.enabled;
  if($('ssl-vpn-port'))$('ssl-vpn-port').value=String(s.listenPort);
  if($('ssl-vpn-cert'))$('ssl-vpn-cert').value=s.serverCertificate;
  if($('ssl-vpn-client-cert'))$('ssl-vpn-client-cert').checked=s.requireClientCertificate;
  if($('ssl-vpn-pool'))$('ssl-vpn-pool').value=s.clientPool;
  if($('ssl-vpn-source'))$('ssl-vpn-source').value=s.sourceAddress;
  if($('ssl-vpn-dns-mode'))$('ssl-vpn-dns-mode').value=s.dnsMode;
  if($('ssl-vpn-dns1'))$('ssl-vpn-dns1').value=s.dns1;
  if($('ssl-vpn-dns2'))$('ssl-vpn-dns2').value=s.dns2;
  if($('ssl-vpn-idle'))$('ssl-vpn-idle').value=String(s.idleTimeout);
  if($('ssl-vpn-auth-timeout'))$('ssl-vpn-auth-timeout').value=String(s.authTimeout);
  if($('ssl-vpn-group'))$('ssl-vpn-group').value=s.authGroup;
  sslVpnSyncDnsVisibility();
}

function sslVpnSyncDnsVisibility(){
  const custom=$('field-ssl-vpn-dns-custom');if(custom)custom.hidden=$('ssl-vpn-dns-mode')?.value!=='Specify';
}

function sslVpnSaveSettings(){
  const errors=[];
  const listenInterface=$('ssl-vpn-interface').value;
  const listenPort=Number($('ssl-vpn-port').value);
  const clientPool=$('ssl-vpn-pool').value.trim();
  const dnsMode=$('ssl-vpn-dns-mode').value;
  const dns1=$('ssl-vpn-dns1').value.trim(),dns2=$('ssl-vpn-dns2').value.trim();
  const idleTimeout=Number($('ssl-vpn-idle').value),authTimeout=Number($('ssl-vpn-auth-timeout').value);
  const authGroup=$('ssl-vpn-group').value.trim(),authPortal=$('ssl-vpn-portal').value;
  if(!findByName(listenInterface)||listenInterface==='ssl.root')errors.push('Select a valid listening interface.');
  if(!Number.isInteger(listenPort)||listenPort<1||listenPort>65535)errors.push('Listen port must be 1-65535.');
  if(!isCIDR(clientPool))errors.push('Client Address Range must be a valid IPv4 CIDR.');
  if(isCIDR(clientPool)){
    const overlap=state.interfaces.find(i=>i.name!=='ssl.root'&&i.type!=='IPsec Tunnel'&&isIPv4(i.ip)&&i.ip!=='0.0.0.0'&&isValidNetmask(i.mask)&&sslVpnCidrsOverlap(clientPool,`${networkAddress(i.ip,i.mask)}/${maskToPrefix(i.mask)}`));
    if(overlap)errors.push(`Client Address Range overlaps interface ${overlap.name}.`);
    const prefix=Number(clientPool.split('/')[1]);if(prefix>29)errors.push('Client Address Range is too small for the simulator; use /29 or larger.');
  }
  if(dnsMode==='Specify'&&(!isIPv4(dns1)||(dns2&&!isIPv4(dns2))))errors.push('Enter valid custom DNS addresses.');
  if(!Number.isInteger(idleTimeout)||idleTimeout<60)errors.push('Idle Timeout must be at least 60 seconds.');
  if(!Number.isInteger(authTimeout)||authTimeout<60)errors.push('Authentication Timeout must be at least 60 seconds.');
  if(!authGroup)errors.push('User/Groups is required.');
  if(!sslVpnPortalByName(authPortal))errors.push('Select a valid SSL-VPN portal.');
  if(errors.length){$('ssl-vpn-settings-errors').textContent=errors.join(' • ');return;}

  Object.assign(state.sslVpn.settings,{
    enabled:$('ssl-vpn-enabled').checked,
    listenInterface,listenPort,
    serverCertificate:$('ssl-vpn-cert').value,
    requireClientCertificate:$('ssl-vpn-client-cert').checked,
    clientPool,sourceAddress:$('ssl-vpn-source').value.trim()||'all',
    dnsMode,dns1,dns2,idleTimeout,authTimeout,authGroup,authPortal
  });
  $('ssl-vpn-settings-errors').textContent='';
  if(!state.sslVpn.settings.enabled)state.sslVpn.sessions.forEach(x=>x.active=false);
  sslVpnSyncInfrastructure();sslVpnEvent('settings',`SSL-VPN settings applied on ${listenInterface}:${listenPort}`);
  saveState();renderAll();sslVpnRenderSettings();
}

function sslVpnCidrsOverlap(a,b){
  if(!isCIDR(a)||!isCIDR(b))return false;
  const [aIp]=a.split('/'),[bIp]=b.split('/');
  return cidrContains(a,bIp)||cidrContains(b,aIp);
}

function sslVpnPortalRefCount(name){
  return (sslVpnSettings().authPortal===name?1:0)+sslVpnActiveSessions().filter(s=>s.portal===name).length;
}

function sslVpnRenderPortals(){
  const body=$('ssl-vpn-portals-body');if(!body)return;body.innerHTML='';
  sslVpnPortals().forEach(p=>{
    const tr=document.createElement('tr');if(p.id===sslVpnSelectedPortalId)tr.classList.add('selected');
    tr.innerHTML=`<td><strong>${esc(p.name)}</strong>${p.builtin?' <span class="status-chip">Built-in</span>':''}</td><td>${p.tunnelMode?'Enabled':'Disabled'}</td><td>${p.webMode?'Enabled':'Disabled'}</td><td>${p.splitTunnel?'Enabled':'Disabled'}</td><td>${esc(p.splitTunnel?(p.splitRoutes.join(', ')||'None'):'0.0.0.0/0')}</td><td>${sslVpnPortalRefCount(p.name)}</td>`;
    tr.addEventListener('click',()=>{sslVpnSelectedPortalId=p.id;sslVpnRenderPortals();});
    tr.addEventListener('dblclick',()=>sslVpnOpenPortalEditor(p));
    body.append(tr);
  });
  sslVpnUpdatePortalButtons();
}

function sslVpnUpdatePortalButtons(){
  const p=sslVpnPortals().find(x=>x.id===sslVpnSelectedPortalId)||null;
  if($('ssl-vpn-portal-edit-button'))$('ssl-vpn-portal-edit-button').disabled=!p;
  if($('ssl-vpn-portal-clone-button'))$('ssl-vpn-portal-clone-button').disabled=!p;
  if($('ssl-vpn-portal-delete-button'))$('ssl-vpn-portal-delete-button').disabled=!p||p.builtin||sslVpnPortalRefCount(p.name)>0;
}

function sslVpnOpenPortalEditor(portal=null){
  const p=portal?sslVpnNormalizePortal(portal):sslVpnNormalizePortal({name:'custom-portal',tunnelMode:true,webMode:false,splitTunnel:true,splitRoutes:['192.168.1.0/24']});
  openModal(portal?'Edit SSL-VPN Portal':'Create SSL-VPN Portal',`
    <div class="form-grid">
      <div class="field"><label for="ssl-portal-name">Name</label><input id="ssl-portal-name" value="${esc(p.name)}" ${portal?'disabled':''}></div>
      <div class="field"><label>Tunnel Mode</label><label class="forti-switch"><input id="ssl-portal-tunnel" type="checkbox" ${p.tunnelMode?'checked':''}><span></span></label></div>
      <div class="field"><label>Web Mode</label><label class="forti-switch"><input id="ssl-portal-web" type="checkbox" ${p.webMode?'checked':''}><span></span></label></div>
      <div class="field"><label>Split Tunneling</label><label class="forti-switch"><input id="ssl-portal-split" type="checkbox" ${p.splitTunnel?'checked':''}><span></span></label></div>
      <div class="field full"><label for="ssl-portal-routes">Routing Addresses</label><input id="ssl-portal-routes" value="${esc((p.splitRoutes||[]).join(', '))}" placeholder="192.168.1.0/24, 192.168.20.0/24"></div>
      <div class="field"><label>Web Bookmarks</label><label class="forti-switch"><input id="ssl-portal-bookmarks" type="checkbox" ${p.allowBookmarks?'checked':''}><span></span></label></div>
      <div class="field full"><label for="ssl-portal-message">Portal Message</label><input id="ssl-portal-message" value="${esc(p.message||'')}"></div>
      <div class="field full"><div id="ssl-portal-editor-error" class="muted"></div></div>
    </div>`,[
    {label:'Cancel',className:'btn-secondary',action:closeModal},
    {label:portal?'OK':'Create',className:'btn-primary',action:()=>sslVpnSavePortal(portal?.id||null)}
  ]);
}

function sslVpnSavePortal(id){
  const old=sslVpnPortals().find(p=>p.id===id)||null;
  const name=old?.name||$('ssl-portal-name').value.trim();
  const tunnelMode=$('ssl-portal-tunnel').checked,webMode=$('ssl-portal-web').checked,splitTunnel=$('ssl-portal-split').checked;
  const splitRoutes=String($('ssl-portal-routes').value||'').split(',').map(x=>x.trim()).filter(Boolean);
  const errors=[];
  if(!name)errors.push('Portal name is required.');
  if(!old&&sslVpnPortals().some(p=>p.name.toLowerCase()===name.toLowerCase()))errors.push('Portal name already exists.');
  if(!tunnelMode&&!webMode)errors.push('Enable Tunnel Mode or Web Mode.');
  if(splitTunnel&&tunnelMode&&splitRoutes.some(x=>!isCIDR(x)))errors.push('All split-tunnel routing addresses must be valid CIDRs.');
  if(splitTunnel&&tunnelMode&&!splitRoutes.length)errors.push('Split Tunnel requires at least one routing address.');
  if(errors.length){$('ssl-portal-editor-error').textContent=errors.join(' • ');return;}
  const data=sslVpnNormalizePortal({...(old||{}),id:old?.id||uid(),name,builtin:old?.builtin||false,tunnelMode,webMode,splitTunnel,splitRoutes:splitTunnel?splitRoutes:['0.0.0.0/0'],allowBookmarks:$('ssl-portal-bookmarks').checked,message:$('ssl-portal-message').value.trim()});
  const idx=sslVpnPortals().findIndex(p=>p.id===data.id);if(idx>=0)state.sslVpn.portals[idx]=data;else state.sslVpn.portals.push(data);
  sslVpnSelectedPortalId=data.id;saveState();closeModal();sslVpnPopulateSettings();sslVpnRenderPortals();
}

function sslVpnClonePortal(){
  const p=sslVpnPortals().find(x=>x.id===sslVpnSelectedPortalId);if(!p)return;
  const clone=structuredClone(p);clone.id=uid();clone.builtin=false;let base=`${p.name}_copy`,n=2;clone.name=base;while(sslVpnPortals().some(x=>x.name===clone.name))clone.name=`${base}_${n++}`;
  state.sslVpn.portals.push(clone);sslVpnSelectedPortalId=clone.id;saveState();sslVpnRenderPortals();sslVpnPopulateSettings();
}

function sslVpnDeletePortal(){
  const p=sslVpnPortals().find(x=>x.id===sslVpnSelectedPortalId);if(!p||p.builtin)return;
  const refs=sslVpnPortalRefCount(p.name);if(refs){alert(`Portal ${p.name} has ${refs} active reference(s).`);return;}
  if(confirm(`Delete SSL-VPN portal "${p.name}"?`)){state.sslVpn.portals=sslVpnPortals().filter(x=>x.id!==p.id);sslVpnSelectedPortalId=null;saveState();sslVpnRenderPortals();sslVpnPopulateSettings();}
}

function sslVpnAllocateClientIp(){
  const cidr=sslVpnSettings().clientPool;if(!isCIDR(cidr))return null;
  const [ip,prefixText]=cidr.split('/'),prefix=Number(prefixText),net=ipToInt(networkAddress(ip,rtPrefixToMask(prefix)));
  const size=Math.pow(2,32-prefix),last=(net+size-1)>>>0;
  const used=new Set(sslVpnActiveSessions().map(s=>s.clientIp));
  for(let n=net+2;n<last;n++){
    const candidate=intToIp(n>>>0);if(!used.has(candidate))return candidate;
  }
  return null;
}

function sslVpnOpenLogin(){
  const s=sslVpnSettings(),portal=sslVpnPortalByName(s.authPortal);
  openModal('Simulate SSL-VPN Login',`
    <div class="form-grid">
      <div class="field"><label for="ssl-login-user">Username</label><input id="ssl-login-user" value="vpnuser"></div>
      <div class="field"><label for="ssl-login-password">Password</label><input id="ssl-login-password" type="password" value="FortiLab123!" autocomplete="new-password"></div>
      <div class="field"><label for="ssl-login-source">Public Source IP</label><input id="ssl-login-source" value="198.51.100.25"></div>
      <div class="field"><label>Authentication Rule</label><div class="muted">${esc(s.authGroup)} → ${esc(portal?.name||s.authPortal)}</div></div>
      <div class="field full"><div id="ssl-login-error" class="muted"></div></div>
    </div>`,[
      {label:'Cancel',className:'btn-secondary',action:closeModal},
      {label:'Login',className:'btn-primary',action:sslVpnLogin}
    ]);
}

function sslVpnLogin(){
  const s=sslVpnSettings(),user=$('ssl-login-user').value.trim(),password=$('ssl-login-password').value,sourceIp=$('ssl-login-source').value.trim();
  const errors=[];
  if(!s.enabled)errors.push('SSL-VPN is disabled.');
  const wan=findByName(s.listenInterface);if(!wan||!sslVpnCoreIsInterfaceOperational(wan))errors.push(`Listening interface ${s.listenInterface} is down.`);
  if(!user)errors.push('Username is required.');
  if(!password)errors.push('Password is required.');
  if(!isIPv4(sourceIp))errors.push('Public Source IP must be a valid IPv4 address.');
  const portal=sslVpnPortalByName(s.authPortal);if(!portal)errors.push('Authentication rule references a missing portal.');
  if(s.requireClientCertificate)errors.push('Client certificate is required; disable it for this simulated password-only login.');
  if(sslVpnActiveSessions().some(x=>x.username===user))errors.push(`User ${user} already has an active simulated session.`);
  const clientIp=errors.length?null:sslVpnAllocateClientIp();if(!clientIp&&!errors.length)errors.push('No free SSL-VPN client addresses are available.');
  if(errors.length){$('ssl-login-error').textContent=errors.join(' • ');return;}
  const session={id:uid(),username:user,group:s.authGroup,sourceIp,clientIp,portal:portal.name,active:true,connectedAt:Date.now(),lastActivity:Date.now(),bytesIn:0,bytesOut:0};
  state.sslVpn.sessions.push(session);sslVpnSelectedSessionId=session.id;sslVpnEvent('login',`${user} connected from ${sourceIp} as ${clientIp} using ${portal.name}`);saveState();closeModal();sslVpnRenderSettings();
}

function sslVpnDisconnectSelected(){
  const session=state.sslVpn.sessions.find(s=>s.id===sslVpnSelectedSessionId&&s.active!==false);if(!session)return;
  session.active=false;session.disconnectedAt=Date.now();sslVpnEvent('logout',`${session.username} disconnected`);sslVpnSelectedSessionId=null;saveState();sslVpnRenderSettings();
}

function sslVpnRenderSessions(){
  const body=$('ssl-vpn-sessions-body');if(!body)return;body.innerHTML='';
  const sessions=sslVpnActiveSessions();
  sessions.forEach(s=>{
    const portal=sslVpnPortalByName(s.portal),tr=document.createElement('tr');if(s.id===sslVpnSelectedSessionId)tr.classList.add('selected');
    const mode=portal?.tunnelMode?(portal.splitTunnel?'Tunnel / Split':'Tunnel / Full'):'Web';
    tr.innerHTML=`<td><strong>${esc(s.username)}</strong></td><td>${esc(s.sourceIp)}</td><td>${esc(s.clientIp)}</td><td>${esc(s.portal)}</td><td>${esc(mode)}</td><td>${esc(new Date(s.connectedAt).toLocaleTimeString())}</td><td>${formatBytes(Number(s.bytesOut)||0)} / ${formatBytes(Number(s.bytesIn)||0)}</td>`;
    tr.addEventListener('click',()=>{sslVpnSelectedSessionId=s.id;sslVpnRenderSessions();});body.append(tr);
  });
  if($('ssl-vpn-disconnect-button'))$('ssl-vpn-disconnect-button').disabled=!sessions.some(s=>s.id===sslVpnSelectedSessionId);
  const s=sslVpnSettings(),portal=sslVpnPortalByName(s.authPortal);
  if($('ssl-vpn-session-status'))$('ssl-vpn-session-status').textContent=`${sessions.length} active session(s) · ${s.listenInterface}:${s.listenPort} · authentication ${s.authGroup} → ${portal?.name||s.authPortal}`;
}

function sslVpnRenderSettings(){sslVpnPopulateSettings();sslVpnRenderSessions();}
function sslVpnRenderAll(){sslVpnRenderSettings();sslVpnRenderPortals();}

function sslVpnFindLanInterface(){
  return state.interfaces.find(i=>i.name!=='ssl.root'&&i.type!=='IPsec Tunnel'&&i.enabled!==false&&i.role==='LAN')||findByName('lan')||null;
}
function sslVpnFindWanInterface(){const s=sslVpnSettings();return findByName(s.listenInterface)||state.interfaces.find(i=>i.role==='WAN'&&i.enabled!==false)||null;}

function sslVpnCreatePolicies(){
  const s=sslVpnSettings(),portal=sslVpnPortalByName(s.authPortal),lan=sslVpnFindLanInterface(),wan=sslVpnFindWanInterface();
  if(!s.enabled){alert('Enable SSL-VPN first.');return;}
  if(!lan){alert('No LAN interface is available for the SSL-VPN policy.');return;}
  const nextId=()=>Math.max(0,...state.policies.map(p=>Number(p.id)||0))+1;
  const add=(name,from,to,nat,comment)=>{
    if(state.policies.some(p=>p.name===name))return false;
    const p={id:nextId(),uid:uid(),name,from,to,source:'SSLVPN_TUNNEL_ADDR',destination:'all',schedule:'always',service:'ALL',action:'ACCEPT',inspectionMode:'Flow-based',nat,natMode:'Outgoing Interface Address',ipPool:'',protocolOptions:'default',trafficShaper:'',antivirus:false,webFilter:false,dnsFilter:false,applicationControl:false,ips:false,fileFilter:false,sslInspection:'no-inspection',logTraffic:'All Sessions',comments:comment,enabled:true,generatedForSslVpn:true};
    const deny=state.policies.findIndex(x=>x.name==='Deny-ALL');state.policies.splice(deny<0?state.policies.length:deny,0,p);return true;
  };
  const local=add('SSLVPN-to-LAN','ssl.root',lan.name,false,`SSL-VPN remote access to ${lan.name}; NAT OFF`);
  let internet=false;
  if(portal?.tunnelMode&&!portal.splitTunnel&&wan)internet=add('SSLVPN-to-Internet','ssl.root',wan.name,true,'SSL-VPN full tunnel Internet access; NAT ON');
  saveState();renderAll();alert(local||internet?'Created the required SSL-VPN firewall policy/policies.':'SSL-VPN policies already exist.');
}

function sslVpnDiagnose(){
  const s=sslVpnSettings(),listen=findByName(s.listenInterface),portal=sslVpnPortalByName(s.authPortal),route=state.routes.find(r=>r.generatedForSslVpn&&r.destination===s.clientPool);
  const lan=sslVpnFindLanInterface(),wan=sslVpnFindWanInterface();
  const lanPolicy=lan&&state.policies.find(p=>p.enabled!==false&&p.from==='ssl.root'&&p.to===lan.name);
  const internetNeeded=Boolean(portal?.tunnelMode&&!portal.splitTunnel),internetPolicy=internetNeeded&&wan?state.policies.find(p=>p.enabled!==false&&p.from==='ssl.root'&&p.to===wan.name):null;
  const checks=[
    ['SSL-VPN status',s.enabled,s.enabled?'Enabled':'Disabled'],
    ['Listening interface',Boolean(listen&&sslVpnCoreIsInterfaceOperational(listen)),listen?`${listen.name} ${sslVpnCoreIsInterfaceOperational(listen)?'up':'down'}`:'Missing'],
    ['Listen port',Number.isInteger(Number(s.listenPort))&&Number(s.listenPort)>0,`${s.listenPort}/TCP`],
    ['Server certificate',Boolean(s.serverCertificate),s.serverCertificate||'Missing'],
    ['Client address range',isCIDR(s.clientPool),s.clientPool],
    ['Client pool route',Boolean(route),route?`${route.destination} → ssl.root`:'Missing'],
    ['Authentication group',Boolean(s.authGroup),s.authGroup||'Missing'],
    ['Portal mapping',Boolean(portal),portal?.name||'Missing'],
    ['SSL-VPN → LAN policy',Boolean(lanPolicy),lanPolicy?.name||'Missing'],
    ['Full-tunnel Internet policy',!internetNeeded||Boolean(internetPolicy),!internetNeeded?'Not required for split/web portal':internetPolicy?.name||'Missing'],
    ['Internet NAT',!internetNeeded||Boolean(internetPolicy?.nat),!internetNeeded?'Not required':internetPolicy?.nat?'NAT ON':'NAT must be ON']
  ];
  openModal('SSL-VPN Diagnose',`<div class="table-wrap full-table-wrap"><table class="data-table"><thead><tr><th>Check</th><th>Status</th><th>Result</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${esc(c[0])}</td><td class="${c[1]?'status-up':'status-deny'}">${c[1]?'✓ PASS':'✕ FAIL'}</td><td>${esc(String(c[2]))}</td></tr>`).join('')}</tbody></table></div><p class="muted">Remote access needs SSL-VPN enabled, authentication/portal mapping, a client pool and a firewall policy from ssl.root to the destination network.</p>`,[{label:'Close',className:'btn-secondary',action:closeModal}]);
}

function sslVpnEvent(type,message){
  state.sslVpn.events.push({id:uid(),timestamp:Date.now(),type,message});
  state.sslVpn.events=state.sslVpn.events.slice(-200);
}

function sslVpnBind(){
  $('ssl-vpn-settings-form')?.addEventListener('submit',e=>{e.preventDefault();sslVpnSaveSettings();});
  $('ssl-vpn-dns-mode')?.addEventListener('change',sslVpnSyncDnsVisibility);
  $('ssl-vpn-create-policy-button')?.addEventListener('click',sslVpnCreatePolicies);
  $('ssl-vpn-diagnose-button')?.addEventListener('click',sslVpnDiagnose);
  $('ssl-vpn-login-button')?.addEventListener('click',sslVpnOpenLogin);
  $('ssl-vpn-disconnect-button')?.addEventListener('click',sslVpnDisconnectSelected);
  $('ssl-vpn-portal-create-button')?.addEventListener('click',()=>sslVpnOpenPortalEditor());
  $('ssl-vpn-portal-edit-button')?.addEventListener('click',()=>{const p=sslVpnPortals().find(x=>x.id===sslVpnSelectedPortalId);if(p)sslVpnOpenPortalEditor(p);});
  $('ssl-vpn-portal-clone-button')?.addEventListener('click',sslVpnClonePortal);
  $('ssl-vpn-portal-delete-button')?.addEventListener('click',sslVpnDeletePortal);
}

const sslVpnCoreIsInterfaceOperational=isInterfaceOperational;
isInterfaceOperational=function(intf){
  if(intf?.name==='ssl.root'||intf?.type==='SSL VPN'){
    const s=sslVpnSettings(),listen=findByName(s.listenInterface);
    return Boolean(s.enabled&&listen&&sslVpnCoreIsInterfaceOperational(listen));
  }
  return sslVpnCoreIsInterfaceOperational(intf);
};

const sslVpnCoreDeleteSelectedInterface=deleteSelectedInterface;
deleteSelectedInterface=function(){
  const target=findInterface(selectedInterfaceId);
  if(target?.name==='ssl.root'||target?.type==='SSL VPN'){alert('ssl.root is managed by VPN → SSL-VPN Settings and cannot be deleted manually.');return;}
  sslVpnCoreDeleteSelectedInterface();
};

const sslVpnCoreEvaluateTraffic=evaluateTraffic;
evaluateTraffic=function(args){
  sslVpnLastContext=null;
  if(args.incoming==='ssl.root'){
    const s=sslVpnSettings();if(!s.enabled)return{action:'DENY',policyId:'-',reason:'SSL-VPN is disabled'};
    const session=sslVpnActiveSessions().find(x=>x.clientIp===args.source);
    if(!session)return{action:'DENY',policyId:'-',reason:`No active SSL-VPN session owns client IP ${args.source}`};
    const portal=sslVpnPortalByName(session.portal);
    if(!portal)return{action:'DENY',policyId:'-',reason:`SSL-VPN portal ${session.portal} no longer exists`};
    if(!portal.tunnelMode)return{action:'DENY',policyId:'-',reason:`Portal ${portal.name} is Web Mode only and does not carry routed tunnel traffic`};
    if(portal.splitTunnel&&!(portal.splitRoutes||[]).some(cidr=>isCIDR(cidr)&&cidrContains(cidr,args.destination))){
      return{action:'DENY',policyId:'-',reason:`Split tunnel portal ${portal.name} does not route ${args.destination} through SSL-VPN`};
    }
    sslVpnLastContext={sessionId:session.id,username:session.username,portal:portal.name,clientIp:session.clientIp,mode:portal.splitTunnel?'split-tunnel':'full-tunnel'};
  }

  const route=findBestRoute(args.destination);
  if(route?.interface==='ssl.root'){
    const session=sslVpnActiveSessions().find(x=>x.clientIp===args.destination);
    if(!session)return{action:'DENY',policyId:'-',reason:`No active SSL-VPN session for destination ${args.destination}`};
  }

  const result=sslVpnCoreEvaluateTraffic(args);
  if(result.action==='ACCEPT'&&sslVpnLastContext){
    const session=state.sslVpn.sessions.find(x=>x.id===sslVpnLastContext.sessionId);
    if(session){session.lastActivity=Date.now();session.bytesOut=(Number(session.bytesOut)||0)+4096;session.bytesIn=(Number(session.bytesIn)||0)+8192;}
    result.reason+=`; SSL-VPN user ${sslVpnLastContext.username} via ${sslVpnLastContext.portal} (${sslVpnLastContext.mode})`;
  }
  return result;
};

const sslVpnCoreOpenTrafficModal=openTrafficModal;
openTrafficModal=function(){
  sslVpnCoreOpenTrafficModal();
  const incoming=$('test-incoming');if(!incoming||!findByName('ssl.root'))return;
  const sync=()=>{
    if(incoming.value!=='ssl.root')return;
    const session=sslVpnActiveSessions()[0];
    if(session&&$('test-source'))$('test-source').value=session.clientIp;
    const lan=sslVpnFindLanInterface();if(lan&&$('test-outgoing'))$('test-outgoing').value=lan.name;
    if($('test-vlan-tag'))$('test-vlan-tag').value='';
    const help=$('test-vlan-help');if(help)help.textContent=session?`SSL-VPN session ${session.username} (${session.clientIp}) → portal ${session.portal} → route → policy → security profiles → log`:'Create an active SSL-VPN session first using VPN → SSL-VPN Settings.';
  };
  incoming.addEventListener('change',sync);sync();
};

const sslVpnCoreRunTraffic=runTraffic;
runTraffic=function(){
  sslVpnLastContext=null;
  const before=state.logs.length;
  sslVpnCoreRunTraffic();
  if(state.logs.length>before&&sslVpnLastContext){
    const log=state.logs[state.logs.length-1];
    Object.assign(log,{sslVpnUser:sslVpnLastContext.username,sslVpnPortal:sslVpnLastContext.portal,sslVpnClientIp:sslVpnLastContext.clientIp,sslVpnMode:sslVpnLastContext.mode});
    saveState();renderAll();
  }
  sslVpnLastContext=null;
};

if(typeof showForwardLogDetails==='function'){
  const sslVpnCoreShowForwardLogDetails=showForwardLogDetails;
  showForwardLogDetails=function(log){
    sslVpnCoreShowForwardLogDetails(log);
    if(!log?.sslVpnUser)return;
    const grid=document.querySelector('#modal-body .forti-log-detail-grid');if(!grid)return;
    [['SSL-VPN User',log.sslVpnUser],['SSL-VPN Client IP',log.sslVpnClientIp],['SSL-VPN Portal',log.sslVpnPortal],['SSL-VPN Mode',log.sslVpnMode]].forEach(([k,v])=>{const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v||'—';grid.append(dt,dd);});
  };
}

const sslVpnCoreShowView=showView;
showView=function(name){
  sslVpnCoreShowView(name);
  if(name==='ssl-vpn-settings'||name==='ssl-vpn-portals'){
    $('nav-vpn-parent')?.classList.add('active');
    $(`nav-${name}`)?.classList.add('active');
    if(name==='ssl-vpn-settings')sslVpnRenderSettings();else sslVpnRenderPortals();
  }
};

const sslVpnCoreRenderAll=renderAll;
renderAll=function(){sslVpnCoreRenderAll();sslVpnRenderAll();};

const sslVpnCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim(),lower=text.toLowerCase(),s=sslVpnSettings();
  if(lower==='show vpn ssl settings'){
    cli(`FG-SIM-01 # ${text}`);
    cli(`config vpn ssl settings
    set status ${s.enabled?'enable':'disable'}
    set source-interface "${s.listenInterface}"
    set port ${s.listenPort}
    set servercert "${s.serverCertificate}"
    set tunnel-ip-pools "SSLVPN_TUNNEL_ADDR"
    set idle-timeout ${s.idleTimeout}
    set auth-timeout ${s.authTimeout}
    config authentication-rule
        edit 1
            set groups "${s.authGroup}"
            set portal "${s.authPortal}"
        next
    end
end`);
    return;
  }
  if(lower==='show vpn ssl web portal'){
    cli(`FG-SIM-01 # ${text}`);
    cli(sslVpnPortals().map(p=>`edit "${p.name}"
    set tunnel-mode ${p.tunnelMode?'enable':'disable'}
    set web-mode ${p.webMode?'enable':'disable'}
    set split-tunneling ${p.splitTunnel?'enable':'disable'}${p.splitTunnel&&p.splitRoutes.length?`
    set split-tunneling-routing-address ${p.splitRoutes.join(' ')}`:''}
next`).join('\n')||'No SSL-VPN portals configured.');
    return;
  }
  if(lower==='get vpn ssl monitor'||lower==='diagnose vpn ssl list'){
    cli(`FG-SIM-01 # ${text}`);
    const sessions=sslVpnActiveSessions();
    cli(sessions.length?sessions.map(x=>`user=${x.username} source=${x.sourceIp} tunnel-ip=${x.clientIp} portal=${x.portal} duration=${Math.floor((Date.now()-x.connectedAt)/1000)}s`).join('\n'):'No active SSL-VPN sessions.');
    return;
  }
  sslVpnCoreRunCli(text);
};

sslVpnPrepareNavigation();
sslVpnPrepareViews();
sslVpnInitState();
document.addEventListener('DOMContentLoaded',()=>{sslVpnBind();sslVpnRenderAll();});
