const STORAGE_KEY = "fortigate-simulator-v1";
const $ = id => typeof document !== "undefined" ? document.getElementById(id) : null;
const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `sim-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const baseInterface = {
  alias:"", role:"LAN", addressingMode:"Manual", members:"", parent:"", vlanId:null,
  access:[], dhcpEnabled:false, dhcpClients:"", dhcpStart:"", dhcpEnd:"", dhcpRange:"",
  dhcpNetmask:"255.255.255.0", dhcpGateway:"", dhcpDns:"Same as System DNS", dhcpDnsCustom:"", dhcpLease:86400,
  dhcpLeases:[], createAddressObject:true, secondaryEnabled:false, secondaryIp:"", secondaryMask:"",
  deviceDetection:true, bandwidthUp:0, bandwidthDown:0, dhcpDefaultRoute:true, dhcpDistance:5,
  pppoeUser:"", pppoePass:"", pppoeStatus:"Disconnected", pppoeSessionId:"",
  dynamicStatus:"Static", acquiredGateway:"", acquiredDns:[], ref:0, enabled:true, linkStatus:"Up"
};

const baseDns = {
  mode:"FortiGuard",
  primary:"96.45.45.45",
  secondary:"96.45.46.46",
  protocols:["TLS"],
  serverHostname:"globalsdns.fortinet.net",
  serverSelectMethod:"Least RTT",
  interfaceSelectMethod:"Auto",
  interface:"wan",
  sourceIp:"0.0.0.0",
  timeout:5,
  retry:2,
  cacheLimit:5000,
  cacheTtl:1800,
  cacheNotFound:false,
  cache:{},
  queryHistory:[]
};

const defaultState = {
  interfaces:[
    {...baseInterface,id:"if-fortilink",group:"802.3ad Aggregate",name:"fortilink",type:"802.3ad Aggregate",ip:"10.255.1.1",mask:"255.255.255.0",access:["PING","Security Fabric Connection"],dhcpEnabled:true,dhcpStart:"10.255.1.2",dhcpEnd:"10.255.1.254",dhcpRange:"10.255.1.2-10.255.1.254",dhcpGateway:"10.255.1.1",ref:2},
    {...baseInterface,id:"if-wan",group:"Physical Interface",name:"wan",type:"Physical Interface",role:"WAN",ip:"192.168.80.49",mask:"255.255.255.0",access:["PING","HTTPS","SSH","HTTP"],createAddressObject:false,deviceDetection:false,bandwidthUp:100,bandwidthDown:500,ref:13},
    {...baseInterface,id:"if-internal2",group:"Physical Interface",name:"internal2",type:"Physical Interface",ip:"192.168.20.1",mask:"255.255.255.0",access:["PING","HTTPS","SSH","HTTP"],dhcpGateway:"192.168.20.1",ref:3},
    {...baseInterface,id:"if-dsl",group:"Physical Interface",name:"dsl",type:"Physical Interface",role:"WAN",addressingMode:"DHCP",ip:"0.0.0.0",mask:"0.0.0.0",access:["PING","FMG-Access"],createAddressObject:false,deviceDetection:false,enabled:false,linkStatus:"Down",dynamicStatus:"Disconnected",ref:1},
    {...baseInterface,id:"if-dmz",group:"Physical Interface",name:"dmz",type:"Physical Interface",role:"DMZ",ip:"10.10.10.1",mask:"255.255.255.0",access:["PING","HTTPS","FMG-Access"],dhcpGateway:"10.10.10.1",deviceDetection:false,linkStatus:"Down"},
    {...baseInterface,id:"if-lan",group:"Software Switch",name:"lan",type:"Software Switch",members:"internal",ip:"192.168.1.99",mask:"255.255.255.0",access:["PING","HTTPS","SSH","HTTP","Security Fabric Connection"],dhcpEnabled:true,dhcpClients:"2",dhcpStart:"192.168.1.100",dhcpEnd:"192.168.1.150",dhcpRange:"192.168.1.100-192.168.1.150",dhcpGateway:"192.168.1.99",dhcpLeases:[
      {ip:"192.168.1.100",mac:"02:00:00:00:00:64",hostname:"client-1",expiresAt:Date.now()+3600000},
      {ip:"192.168.1.101",mac:"02:00:00:00:00:65",hostname:"client-2",expiresAt:Date.now()+3600000}
    ],ref:13}
  ],
  routes:[
    {id:"rt-default",destination:"0.0.0.0/0",gateway:"192.168.80.1",interface:"wan",distance:10,enabled:true,type:"static"},
    {id:"rt-fortilink",destination:"10.255.1.0/24",gateway:"0.0.0.0",interface:"fortilink",distance:0,enabled:true,connected:true,type:"connected"},
    {id:"rt-internal2",destination:"192.168.20.0/24",gateway:"0.0.0.0",interface:"internal2",distance:0,enabled:true,connected:true,type:"connected"},
    {id:"rt-lan",destination:"192.168.1.0/24",gateway:"0.0.0.0",interface:"lan",distance:0,enabled:true,connected:true,type:"connected"},
    {id:"rt-dmz",destination:"10.10.10.0/24",gateway:"0.0.0.0",interface:"dmz",distance:0,enabled:true,connected:true,type:"connected"}
  ],
  policies:[
    {id:1,uid:"pol-1",name:"LAN-to-WAN",from:"lan",to:"wan",source:"LAN_Subnet",destination:"all",service:"ALL",action:"ACCEPT",nat:true,enabled:true},
    {id:2,uid:"pol-2",name:"LAN-to-DMZ",from:"lan",to:"dmz",source:"LAN_Subnet",destination:"DMZ_Subnet",service:"ALL",action:"ACCEPT",nat:false,enabled:true},
    {id:3,uid:"pol-3",name:"Deny-ALL",from:"all",to:"all",source:"all",destination:"all",service:"ALL",action:"DENY",nat:false,enabled:true}
  ],
  logs:[{id:uid(),time:new Date().toLocaleTimeString(),action:"ACCEPT",policy:1,source:"192.168.1.50",destination:"8.8.8.8",service:"PING",reason:"Policy matched; NAT applied"}],
  dns:structuredClone(baseDns)
};

let state = loadState();
let selectedInterfaceId=null, selectedRouteId=null, selectedPolicyUid=null, editingInterfaceId=null;

function init(){
  ensureRuntimeControls();
  ensureDnsView();
  ensureDnsState();
  bindNavigation(); bindInterfaces(); bindDns(); bindRoutes(); bindPolicies(); bindLogs(); bindModal(); bindCli();
  $("sidebar-toggle")?.addEventListener("click",()=>$("sidebar").classList.toggle("mobile-open"));
  reconcileAllGeneratedRoutes();
  renderAll();
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded",init);

function ensureRuntimeControls(){
  if(!$("editor-dhcp-dns-custom") && $("field-dhcp-dns")){
    const row=document.createElement("div");
    row.id="field-dhcp-dns-custom"; row.className="forti-field-row"; row.hidden=true;
    row.innerHTML='<label id="label-dhcp-dns-custom" for="editor-dhcp-dns-custom">DNS Server IP</label><div id="control-dhcp-dns-custom"><input id="editor-dhcp-dns-custom" type="text" placeholder="8.8.8.8" /></div>';
    $("field-dhcp-dns").insertAdjacentElement("afterend",row);
  }
  if(!$("dhcp-client-runtime-status") && $("control-dhcp-client")){
    const status=document.createElement("div"); status.id="dhcp-client-runtime-status"; status.className="muted";
    const actions=document.createElement("div"); actions.id="dhcp-client-runtime-actions"; actions.className="inline-controls";
    actions.innerHTML='<button id="dhcp-client-renew-button" type="button" class="btn-secondary">Renew Lease</button><button id="dhcp-client-release-button" type="button" class="btn-secondary">Release</button>';
    $("control-dhcp-client").append(status,actions);
  }
  if(!$("pppoe-runtime-status") && $("control-pppoe")){
    const status=document.createElement("div"); status.id="pppoe-runtime-status"; status.className="muted";
    const actions=document.createElement("div"); actions.id="pppoe-runtime-actions"; actions.className="inline-controls";
    actions.innerHTML='<button id="pppoe-connect-button" type="button" class="btn-secondary">Connect</button><button id="pppoe-disconnect-button" type="button" class="btn-secondary">Disconnect</button>';
    $("control-pppoe").append(status,actions);
  }
  if(!$("dhcp-server-runtime-actions") && $("dhcp-settings-block")){
    const row=document.createElement("div"); row.id="field-dhcp-runtime"; row.className="forti-field-row";
    row.innerHTML='<label id="label-dhcp-runtime">DHCP Simulation</label><div id="control-dhcp-runtime" class="stacked-controls"><div id="dhcp-server-runtime-actions" class="inline-controls"><button id="dhcp-add-client-button" type="button" class="btn-secondary">Simulate Client Lease</button><button id="dhcp-clear-clients-button" type="button" class="btn-secondary">Clear Leases</button></div><div id="dhcp-server-runtime-status" class="muted"></div></div>';
    $("dhcp-settings-block").append(row);
  }
}

function ensureDnsView(){
  const nav=$("nav-dns");
  if(nav){nav.dataset.view="dns";delete nav.dataset.title;}
  if($("view-dns")||!$("main-content"))return;
  const section=document.createElement("section");
  section.id="view-dns"; section.className="app-view";
  section.innerHTML=`
    <div id="dns-header" class="page-heading-row"><h1 id="dns-title">DNS</h1></div>
    <form id="dns-form" novalidate>
      <section id="dns-server-section" class="forti-form-section">
        <h2 id="dns-server-title">DNS Servers</h2>
        <div id="dns-server-fields" class="forti-form-body">
          <div id="field-dns-mode" class="forti-field-row">
            <label id="label-dns-mode">DNS servers</label>
            <div id="control-dns-mode" class="forti-radio-row">
              <label id="dns-mode-fortiguard-label"><input id="dns-mode-fortiguard" type="radio" name="dns-mode" value="FortiGuard" /> Use FortiGuard Servers</label>
              <label id="dns-mode-custom-label"><input id="dns-mode-custom" type="radio" name="dns-mode" value="Custom" /> Specify</label>
            </div>
          </div>
          <div id="field-dns-primary" class="forti-field-row">
            <label id="label-dns-primary" for="dns-primary">Primary DNS server</label>
            <div id="control-dns-primary"><input id="dns-primary" type="text" inputmode="decimal" /></div>
          </div>
          <div id="field-dns-secondary" class="forti-field-row">
            <label id="label-dns-secondary" for="dns-secondary">Secondary DNS server</label>
            <div id="control-dns-secondary"><input id="dns-secondary" type="text" inputmode="decimal" /></div>
          </div>
          <div id="field-dns-protocols" class="forti-field-row">
            <label id="label-dns-protocols">DNS Protocols</label>
            <div id="control-dns-protocols" class="forti-access-grid">
              <label id="dns-protocol-cleartext-label"><input id="dns-protocol-cleartext" type="checkbox" value="Cleartext" /> Cleartext (53)</label>
              <label id="dns-protocol-tls-label"><input id="dns-protocol-tls" type="checkbox" value="TLS" /> TLS (853)</label>
              <label id="dns-protocol-https-label"><input id="dns-protocol-https" type="checkbox" value="HTTPS" /> HTTPS (443)</label>
            </div>
          </div>
          <div id="field-dns-hostname" class="forti-field-row">
            <label id="label-dns-hostname" for="dns-hostname">Server hostname</label>
            <div id="control-dns-hostname"><input id="dns-hostname" type="text" placeholder="dns.example.com" /></div>
          </div>
          <div id="field-dns-server-select" class="forti-field-row">
            <label id="label-dns-server-select" for="dns-server-select">Server select method</label>
            <div id="control-dns-server-select"><select id="dns-server-select"><option>Least RTT</option><option>Failover</option></select></div>
          </div>
        </div>
      </section>

      <section id="dns-routing-section" class="forti-form-section">
        <h2 id="dns-routing-title">Routing</h2>
        <div id="dns-routing-fields" class="forti-form-body">
          <div id="field-dns-interface-method" class="forti-field-row">
            <label id="label-dns-interface-method" for="dns-interface-method">Interface select method</label>
            <div id="control-dns-interface-method"><select id="dns-interface-method"><option>Auto</option><option>SD-WAN</option><option>Specify</option></select></div>
          </div>
          <div id="field-dns-interface" class="forti-field-row" hidden>
            <label id="label-dns-interface" for="dns-interface">Interface</label>
            <div id="control-dns-interface"><select id="dns-interface"></select></div>
          </div>
          <div id="field-dns-source-ip" class="forti-field-row">
            <label id="label-dns-source-ip" for="dns-source-ip">Source IP</label>
            <div id="control-dns-source-ip"><input id="dns-source-ip" type="text" value="0.0.0.0" /></div>
          </div>
        </div>
      </section>

      <section id="dns-cache-section" class="forti-form-section">
        <h2 id="dns-cache-title">DNS Cache</h2>
        <div id="dns-cache-fields" class="forti-form-body">
          <div id="field-dns-timeout" class="forti-field-row"><label id="label-dns-timeout" for="dns-timeout">Timeout</label><div id="control-dns-timeout" class="inline-controls"><input id="dns-timeout" type="number" min="1" max="10" /><span>seconds</span></div></div>
          <div id="field-dns-retry" class="forti-field-row"><label id="label-dns-retry" for="dns-retry">Retry</label><div id="control-dns-retry"><input id="dns-retry" type="number" min="0" max="5" /></div></div>
          <div id="field-dns-cache-limit" class="forti-field-row"><label id="label-dns-cache-limit" for="dns-cache-limit">Cache limit</label><div id="control-dns-cache-limit"><input id="dns-cache-limit" type="number" min="0" /></div></div>
          <div id="field-dns-cache-ttl" class="forti-field-row"><label id="label-dns-cache-ttl" for="dns-cache-ttl">Cache TTL</label><div id="control-dns-cache-ttl" class="inline-controls"><input id="dns-cache-ttl" type="number" min="60" max="86400" /><span>seconds</span></div></div>
          <div id="field-dns-cache-notfound" class="forti-field-row"><label id="label-dns-cache-notfound">Cache NOT FOUND responses</label><div id="control-dns-cache-notfound"><label id="dns-cache-notfound-switch" class="forti-switch"><input id="dns-cache-notfound" type="checkbox" /><span></span></label></div></div>
        </div>
      </section>

      <div id="dns-form-errors" class="status-deny" role="alert" aria-live="polite"></div>
      <div id="dns-actions" class="toolbar"><button id="dns-apply-button" type="submit" class="btn-primary">Apply</button><button id="dns-reset-button" type="button" class="btn-secondary">Reset Fields</button></div>
    </form>

    <section id="dns-test-section" class="forti-form-section">
      <h2 id="dns-test-title">DNS Test</h2>
      <div id="dns-test-fields" class="forti-form-body">
        <div id="field-dns-test-name" class="forti-field-row"><label id="label-dns-test-name" for="dns-test-name">Domain</label><div id="control-dns-test-name" class="inline-controls"><input id="dns-test-name" type="text" value="www.example.com" /><button id="dns-test-button" type="button" class="btn-primary">Resolve</button><button id="dns-clear-cache-button" type="button" class="btn-secondary">Clear Cache</button></div></div>
        <div id="field-dns-test-result" class="forti-field-row"><label id="label-dns-test-result">Result</label><div id="dns-test-result" class="muted">Ready.</div></div>
      </div>
    </section>

    <div id="dns-status-wrap" class="table-wrap full-table-wrap">
      <table id="dns-status-table" class="data-table"><thead><tr><th>Server</th><th>Address</th><th>Protocol</th><th>Route</th><th>Status</th><th>RTT</th></tr></thead><tbody id="dns-status-body"></tbody></table>
    </div>
  `;
  const anchor=$("view-static-routes");
  if(anchor) anchor.before(section); else $("main-content").append(section);
}

function ensureDnsState(){state.dns=normalizeDns(state.dns);}
function normalizeDns(dns){
  const x={...baseDns,...(dns||{})};
  x.protocols=Array.isArray(x.protocols)&&x.protocols.length?x.protocols:["Cleartext"];
  x.cache=x.cache&&typeof x.cache==="object"&&!Array.isArray(x.cache)?x.cache:{};
  x.queryHistory=Array.isArray(x.queryHistory)?x.queryHistory:[];
  return x;
}

function bindNavigation(){
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{
    if(b.dataset.view==="placeholder") $("placeholder-title").textContent=b.dataset.title||"Module";
    showView(b.dataset.view);
  }));
  $("nav-network")?.addEventListener("click",()=>$("network-subnav").hidden=!$("network-subnav").hidden);
}

function showView(name){
  document.querySelectorAll(".app-view").forEach(v=>v.classList.remove("active-view"));
  document.querySelectorAll(".nav-item,.subnav-item").forEach(v=>v.classList.remove("active"));
  const target=$(`view-${name}`)||$("view-placeholder"); target?.classList.add("active-view");
  const nav=document.querySelector(`[data-view="${name}"]`); if(nav) nav.classList.add("active");
  if(name==="dns")renderDns();
  if(innerWidth<=760) $("sidebar")?.classList.remove("mobile-open");
}

function bindInterfaces(){
  $("interface-create-button")?.addEventListener("click",e=>{e.stopPropagation();const m=$("interface-create-menu");m.hidden=!m.hidden;$("interface-create-button").setAttribute("aria-expanded",String(!m.hidden));});
  document.querySelectorAll("[data-create-interface]").forEach(b=>b.addEventListener("click",()=>{ $("interface-create-menu").hidden=true; openInterfaceEditor(null,b.dataset.createInterface); }));
  document.addEventListener("click",e=>{if($("interface-create-wrap")&&!$("interface-create-wrap").contains(e.target)) $("interface-create-menu").hidden=true;});
  $("interface-edit-button")?.addEventListener("click",()=>{const x=findInterface(selectedInterfaceId);if(x)openInterfaceEditor(x);});
  $("interface-delete-button")?.addEventListener("click",deleteSelectedInterface);
  $("interface-search")?.addEventListener("input",renderInterfaces);
  $("interface-group-select")?.addEventListener("change",renderInterfaces);
  $("interface-search-button")?.addEventListener("click",()=>$("interface-search").focus());
  $("interface-editor-form")?.addEventListener("submit",e=>{e.preventDefault();saveInterfaceEditor();});
  $("interface-editor-cancel")?.addEventListener("click",closeInterfaceEditor);
  $("interface-editor-cancel-top")?.addEventListener("click",closeInterfaceEditor);
  $("editor-type")?.addEventListener("change",updateEditorVisibility);
  $("editor-role")?.addEventListener("change",updateEditorVisibility);
  document.querySelectorAll('input[name="editor-address-mode"]').forEach(r=>r.addEventListener("change",updateEditorVisibility));
  $("editor-secondary-enabled")?.addEventListener("change",updateEditorVisibility);
  $("editor-dhcp-enabled")?.addEventListener("change",()=>{syncDhcpDefaults();updateEditorVisibility();});
  $("editor-dhcp-dns")?.addEventListener("change",updateEditorVisibility);
  $("editor-ip")?.addEventListener("change",syncDhcpDefaults);
  $("editor-mask")?.addEventListener("change",syncDhcpDefaults);
  $("admin-http")?.addEventListener("change",()=>{if($("admin-http").checked) $("admin-https").checked=true;});
  $("admin-https")?.addEventListener("change",()=>{if(!$("admin-https").checked) $("admin-http").checked=false;});
  $("dhcp-client-renew-button")?.addEventListener("click",renewEditingDhcpClient);
  $("dhcp-client-release-button")?.addEventListener("click",releaseEditingDhcpClient);
  $("pppoe-connect-button")?.addEventListener("click",connectEditingPppoe);
  $("pppoe-disconnect-button")?.addEventListener("click",disconnectEditingPppoe);
  $("dhcp-add-client-button")?.addEventListener("click",simulateEditingDhcpLease);
  $("dhcp-clear-clients-button")?.addEventListener("click",clearEditingDhcpLeases);
}

function renderInterfaces(){
  const body=$("interfaces-table-body"); if(!body)return;
  const q=$("interface-search")?.value.trim().toLowerCase()||"", group=$("interface-group-select")?.value||"type";
  body.innerHTML=""; let last="";
  const items=state.interfaces.filter(i=>[i.name,i.type,i.members,i.ip,i.alias,i.role,i.addressingMode,i.dynamicStatus].join(" ").toLowerCase().includes(q));
  items.forEach(i=>{
    if(group==="type"&&i.group!==last){const g=document.createElement("tr");g.className="group-row";g.innerHTML=`<td colspan="8">⊟ ${esc(i.group)} <span class="status-chip">${items.filter(x=>x.group===i.group).length}</span></td>`;body.append(g);last=i.group;}
    const tr=document.createElement("tr"); if(i.id===selectedInterfaceId) tr.classList.add("selected");
    const access=(i.access||[]).map(a=>`<span class="access-chip">${esc(a)}</span>`).join("");
    const ref=getRefCount(i), modeInfo=i.addressingMode!=="Manual"?`<div class="muted">${esc(i.addressingMode)} · ${esc(i.dynamicStatus||i.pppoeStatus||"")}</div>`:"";
    tr.innerHTML=`<td>${i.enabled?"▣":"▤"} <strong>${esc(i.name)}</strong>${i.alias?`<div class="muted">${esc(i.alias)}</div>`:""}</td><td>${esc(i.type)}${modeInfo}</td><td>${esc(i.members||"")}</td><td>${esc(i.ip)}/${esc(i.mask)}</td><td>${access||"-"}</td><td>${esc(i.dhcpClients||"")}</td><td>${esc(i.dhcpRange||"")}</td><td><button class="text-link interface-ref-button" type="button">${ref}</button></td>`;
    tr.addEventListener("click",e=>{if(e.target.classList.contains("interface-ref-button")){showReferences(i);return;} selectedInterfaceId=i.id;renderInterfaces();updateButtons();});
    tr.addEventListener("dblclick",()=>openInterfaceEditor(i)); body.append(tr);
  }); updateButtons();
}

function openInterfaceEditor(item,type="Interface"){
  editingInterfaceId=item?.id||null;
  const draft=item?normalizeInterface(item):newInterfaceDraft(type);
  $("interface-editor-title").textContent=item?`Edit Interface - ${item.name}`:`Create New ${type}`;
  $("editor-name").value=draft.name; $("editor-name").disabled=!!item;
  $("editor-alias").value=draft.alias; $("editor-type").value=draft.type; $("editor-type").disabled=!!item;
  populateParents(draft.parent); $("editor-vlan-id").value=draft.vlanId||10; $("editor-role").value=draft.role;
  $("editor-bandwidth-up").value=draft.bandwidthUp||0; $("editor-bandwidth-down").value=draft.bandwidthDown||0;
  document.querySelectorAll('input[name="editor-address-mode"]').forEach(r=>r.checked=r.value===draft.addressingMode);
  $("editor-ip").value=draft.ip; $("editor-mask").value=draft.mask;
  $("editor-dhcp-default-route").checked=draft.dhcpDefaultRoute; $("editor-dhcp-distance").value=draft.dhcpDistance;
  $("editor-pppoe-user").value=draft.pppoeUser; $("editor-pppoe-pass").value=draft.pppoePass;
  $("editor-create-address").checked=draft.createAddressObject; $("editor-secondary-enabled").checked=draft.secondaryEnabled;
  $("editor-secondary-ip").value=draft.secondaryIp; $("editor-secondary-mask").value=draft.secondaryMask;
  document.querySelectorAll("#control-ipv4-admin-access input[type=checkbox]").forEach(c=>c.checked=(draft.access||[]).includes(c.value));
  $("editor-dhcp-enabled").checked=draft.dhcpEnabled; $("editor-dhcp-start").value=draft.dhcpStart; $("editor-dhcp-end").value=draft.dhcpEnd;
  $("editor-dhcp-netmask").value=draft.dhcpNetmask||draft.mask; $("editor-dhcp-gateway").value=draft.dhcpGateway||draft.ip;
  $("editor-dhcp-dns").value=draft.dhcpDns; if($("editor-dhcp-dns-custom")) $("editor-dhcp-dns-custom").value=draft.dhcpDnsCustom||"";
  $("editor-dhcp-lease").value=draft.dhcpLease;
  $("editor-device-detection").checked=draft.deviceDetection; $("editor-enabled").checked=draft.enabled;
  $("interface-editor-errors").textContent=""; updateEditorVisibility(); updateRuntimeStatus(draft); showView("interface-editor");
}

function newInterfaceDraft(type){
  let realType=type==="Interface"?"VLAN":type, role="LAN";
  return normalizeInterface({...baseInterface,id:uid(),group:groupForType(realType),name:realType==="VLAN"?"vlan10":realType==="Software Switch"?"switch1":realType==="802.3ad Aggregate"?"aggregate1":"loopback1",type:realType,role,ip:realType==="Loopback Interface"?"10.0.0.1":"192.168.10.1",mask:realType==="Loopback Interface"?"255.255.255.255":"255.255.255.0",parent:realType==="VLAN"?"lan":"",vlanId:realType==="VLAN"?10:null,access:["PING","HTTPS"]});
}

function closeInterfaceEditor(){editingInterfaceId=null;showView("interfaces");}
function populateParents(selected=""){$("editor-parent").innerHTML=state.interfaces.filter(i=>i.type!=="VLAN"&&i.type!=="Loopback Interface").map(i=>`<option ${i.name===selected?"selected":""}>${esc(i.name)}</option>`).join("");}
function currentAddressMode(){return document.querySelector('input[name="editor-address-mode"]:checked')?.value||"Manual";}
function setHidden(id,val){const el=$(id);if(!el)return;el.hidden=val;el.style.display=val?"none":"";}

function updateEditorVisibility(){
  const type=$("editor-type").value, role=$("editor-role").value, mode=currentAddressMode(), vlan=type==="VLAN", wan=role==="WAN", manual=mode==="Manual";
  setHidden("field-parent-interface",!vlan); setHidden("field-vlan-id",!vlan); setHidden("field-estimated-bandwidth",!wan);
  setHidden("field-ip-netmask",!manual); setHidden("field-dhcp-client",mode!=="DHCP"); setHidden("field-pppoe",mode!=="PPPoE");
  setHidden("field-secondary-ip",!manual); setHidden("field-secondary-ip-values",!manual||!$("editor-secondary-enabled").checked);
  setHidden("field-create-address",wan||role==="Undefined"||!manual);
  setHidden("interface-dhcp-section",wan||!manual); setHidden("dhcp-settings-block",!$("editor-dhcp-enabled").checked);
  setHidden("field-dhcp-dns-custom",$("editor-dhcp-dns")?.value!=="Specify");
  setHidden("interface-device-section",wan);
  $("interface-editor-warning").hidden=!(editingInterfaceId&&["lan","internal2"].includes(findInterface(editingInterfaceId)?.name));
  updateRuntimeStatus(readEditorDraft(false));
}

function syncDhcpDefaults(){if(!$("editor-dhcp-enabled").checked)return; $("editor-dhcp-netmask").value=$("editor-mask").value; $("editor-dhcp-gateway").value=$("editor-ip").value;}

function readEditorDraft(includeDynamic=true){
  const old=findInterface(editingInterfaceId), type=$("editor-type")?.value||old?.type||"Physical Interface", role=$("editor-role")?.value||old?.role||"LAN", mode=currentAddressMode();
  const x=normalizeInterface({...(old||baseInterface),id:old?.id||uid(),name:$("editor-name")?.value.trim()||old?.name||"",alias:$("editor-alias")?.value.trim()||"",type,group:groupForType(type),role,addressingMode:mode,parent:type==="VLAN"?$("editor-parent")?.value||"":"",vlanId:type==="VLAN"?Number($("editor-vlan-id")?.value):null,
    ip:mode==="Manual"?$("editor-ip")?.value.trim()||"0.0.0.0":(includeDynamic?old?.ip||"0.0.0.0":"0.0.0.0"),mask:mode==="Manual"?$("editor-mask")?.value.trim()||"0.0.0.0":(includeDynamic?old?.mask||"0.0.0.0":"0.0.0.0"),
    access:[...document.querySelectorAll("#control-ipv4-admin-access input:checked")].map(c=>c.value),bandwidthUp:Number($("editor-bandwidth-up")?.value||0),bandwidthDown:Number($("editor-bandwidth-down")?.value||0),dhcpDefaultRoute:$("editor-dhcp-default-route")?.checked??true,dhcpDistance:Number($("editor-dhcp-distance")?.value||5),pppoeUser:$("editor-pppoe-user")?.value||"",pppoePass:$("editor-pppoe-pass")?.value||"",
    createAddressObject:$("editor-create-address")?.checked??false,secondaryEnabled:$("editor-secondary-enabled")?.checked??false,secondaryIp:$("editor-secondary-ip")?.value.trim()||"",secondaryMask:$("editor-secondary-mask")?.value.trim()||"",
    dhcpEnabled:($("editor-dhcp-enabled")?.checked??false)&&role!=="WAN"&&mode==="Manual",dhcpStart:$("editor-dhcp-start")?.value.trim()||"",dhcpEnd:$("editor-dhcp-end")?.value.trim()||"",dhcpNetmask:$("editor-dhcp-netmask")?.value.trim()||"",dhcpGateway:$("editor-dhcp-gateway")?.value.trim()||"",dhcpDns:$("editor-dhcp-dns")?.value||"Same as System DNS",dhcpDnsCustom:$("editor-dhcp-dns-custom")?.value.trim()||"",dhcpLease:Number($("editor-dhcp-lease")?.value||86400),deviceDetection:$("editor-device-detection")?.checked??false,enabled:$("editor-enabled")?.checked??true,linkStatus:($("editor-enabled")?.checked??true)?"Up":"Down"});
  x.dhcpRange=x.dhcpEnabled?`${x.dhcpStart}-${x.dhcpEnd}`:"";
  return x;
}

function saveInterfaceEditor(){
  const old=findInterface(editingInterfaceId), x=readEditorDraft(false);
  const errors=validateInterface(x,old); if(errors.length){$("interface-editor-errors").textContent=errors.join(" • ");return;}
  if(x.addressingMode==="DHCP") simulateDhcpAcquire(x);
  else if(x.addressingMode==="PPPoE") simulatePppoeConnect(x);
  else if(x.addressingMode==="One-Arm Sniffer"){x.ip="0.0.0.0";x.mask="0.0.0.0";x.dynamicStatus="Sniffer";x.pppoeStatus="Disconnected";}
  else {x.dynamicStatus="Static";x.pppoeStatus="Disconnected";x.acquiredGateway="";x.acquiredDns=[];}
  if(!x.enabled){disconnectDynamicInterface(x);x.linkStatus="Down";}
  if(old) state.interfaces[state.interfaces.findIndex(i=>i.id===old.id)]=x; else state.interfaces.push(x);
  syncInterfaceRoutes(x,old); saveState(); selectedInterfaceId=x.id; renderAll(); closeInterfaceEditor();
}

function validateInterface(x,old){
  const e=[];
  if(!x.name)e.push("Interface name is required");
  if(!old&&state.interfaces.some(i=>i.name.toLowerCase()===x.name.toLowerCase())) e.push("Interface name already exists");
  if(x.type==="VLAN"&&(!Number.isInteger(x.vlanId)||x.vlanId<1||x.vlanId>4094)) e.push("VLAN ID must be 1-4094");
  if(x.type==="VLAN"&&!x.parent)e.push("VLAN parent interface is required");
  if(x.type==="VLAN"&&state.interfaces.some(i=>i.id!==x.id&&i.type==="VLAN"&&i.parent===x.parent&&i.vlanId===x.vlanId)) e.push("This VLAN ID already exists on the parent interface");
  if(x.addressingMode==="Manual"){
    if(!isIPv4(x.ip)||!isValidNetmask(x.mask)) e.push("Enter a valid IPv4 address and contiguous netmask");
    if(isIPv4(x.ip)&&isValidNetmask(x.mask)&&x.mask!=="255.255.255.255"&&state.interfaces.some(i=>i.id!==x.id&&i.addressingMode==="Manual"&&isIPv4(i.ip)&&isValidNetmask(i.mask)&&subnetsOverlap(x.ip,x.mask,i.ip,i.mask))) e.push("IP subnet overlaps another interface");
  }
  if(x.addressingMode==="DHCP"&&(x.dhcpDistance<1||x.dhcpDistance>255)) e.push("DHCP route distance must be 1-255");
  if(x.addressingMode==="PPPoE"){
    if(!x.pppoeUser.trim()) e.push("PPPoE username is required");
    if(!x.pppoePass) e.push("PPPoE password is required");
  }
  if(x.secondaryEnabled&&(!isIPv4(x.secondaryIp)||!isValidNetmask(x.secondaryMask))) e.push("Secondary IP/Netmask is invalid");
  if(x.dhcpEnabled){
    if(!isIPv4(x.dhcpStart)||!isIPv4(x.dhcpEnd)) e.push("DHCP start/end must be valid IPv4 addresses");
    else if(ipToInt(x.dhcpStart)>ipToInt(x.dhcpEnd)) e.push("DHCP start must be before DHCP end");
    else if(!sameSubnet(x.ip,x.dhcpStart,x.mask)||!sameSubnet(x.ip,x.dhcpEnd,x.mask)) e.push("DHCP range must stay inside interface subnet");
    else if(ipToInt(x.ip)>=ipToInt(x.dhcpStart)&&ipToInt(x.ip)<=ipToInt(x.dhcpEnd)) e.push("DHCP range cannot include the interface IP");
    else if(isNetworkOrBroadcast(x.dhcpStart,x.ip,x.mask)||isNetworkOrBroadcast(x.dhcpEnd,x.ip,x.mask)) e.push("DHCP range cannot use network or broadcast address");
    if(!isValidNetmask(x.dhcpNetmask)||x.dhcpNetmask!==x.mask) e.push("DHCP netmask must match interface netmask");
    if(!isIPv4(x.dhcpGateway)||!sameSubnet(x.ip,x.dhcpGateway,x.mask)) e.push("DHCP gateway must be inside interface subnet");
    if(x.dhcpDns==="Specify"&&!isIPv4(x.dhcpDnsCustom)) e.push("Specified DHCP DNS server must be a valid IPv4 address");
    if(!Number.isFinite(x.dhcpLease)||x.dhcpLease<60) e.push("DHCP lease time must be at least 60 seconds");
  }
  return e;
}

function normalizeInterface(i){
  const x={...baseInterface,...i};
  x.group=x.group||groupForType(x.type); x.dhcpLeases=Array.isArray(x.dhcpLeases)?x.dhcpLeases:[]; x.acquiredDns=Array.isArray(x.acquiredDns)?x.acquiredDns:[];
  repairLegacyDhcpRange(x);
  x.dhcpRange=x.dhcpEnabled&&x.dhcpStart&&x.dhcpEnd?`${x.dhcpStart}-${x.dhcpEnd}`:(x.dhcpRange||"");
  x.dhcpClients=x.dhcpEnabled?String(x.dhcpLeases.length||Number(x.dhcpClients||0)):"";
  if(x.addressingMode==="Manual"&&!x.dynamicStatus)x.dynamicStatus="Static";
  return x;
}

function repairLegacyDhcpRange(x){
  if(!x.dhcpEnabled||!isIPv4(x.ip)||!isValidNetmask(x.mask)||!isIPv4(x.dhcpStart)||!isIPv4(x.dhcpEnd))return;
  const me=ipToInt(x.ip),start=ipToInt(x.dhcpStart),end=ipToInt(x.dhcpEnd);
  if(me<start||me>end)return;
  const broadcast=ipToInt(broadcastAddress(x.ip,x.mask)),network=ipToInt(networkAddress(x.ip,x.mask));
  if(me+1<=end&&me+1<broadcast)x.dhcpStart=intToIp(me+1);
  else if(me-1>=start&&me-1>network)x.dhcpEnd=intToIp(me-1);
  x.dhcpLeases=(x.dhcpLeases||[]).filter(l=>isIPv4(l.ip)&&ipToInt(l.ip)>=ipToInt(x.dhcpStart)&&ipToInt(l.ip)<=ipToInt(x.dhcpEnd)&&l.ip!==x.ip);
}
function groupForType(t){return t==="VLAN"?"VLAN Interface":t==="Loopback Interface"?"Loopback Interface":t;}
function findInterface(id){return state.interfaces.find(i=>i.id===id);}
function findByName(name){return state.interfaces.find(i=>i.name===name);}

function simulateDhcpAcquire(x){
  if(!x.enabled){disconnectDynamicInterface(x);return x;}
  const profile=dhcpProfileForInterface(x);
  x.ip=profile.ip; x.mask=profile.mask; x.acquiredGateway=profile.gateway; x.acquiredDns=profile.dns;
  x.dynamicStatus="Connected"; x.pppoeStatus="Disconnected"; x.linkStatus="Up";
  return x;
}
function dhcpProfileForInterface(x){
  if(x.name==="wan") return {ip:"192.168.80.49",mask:"255.255.255.0",gateway:"192.168.80.1",dns:["8.8.8.8","1.1.1.1"]};
  if(x.name==="dsl") return {ip:"192.168.100.2",mask:"255.255.255.0",gateway:"192.168.100.1",dns:["8.8.8.8","1.1.1.1"]};
  const octet=(hashText(x.name)%180)+20;
  return {ip:`172.20.${octet}.100`,mask:"255.255.255.0",gateway:`172.20.${octet}.1`,dns:["8.8.8.8","1.1.1.1"]};
}
function simulatePppoeConnect(x){
  if(!x.enabled){disconnectDynamicInterface(x);return x;}
  if(!x.pppoeUser||!x.pppoePass){x.pppoeStatus="Authentication Failed";x.dynamicStatus="Disconnected";x.ip="0.0.0.0";x.mask="0.0.0.0";return x;}
  const a=(hashText(x.pppoeUser)%200)+20, b=(hashText(x.name+x.pppoeUser)%200)+20;
  x.ip=`100.64.${a}.${b}`; x.mask="255.255.255.255"; x.acquiredGateway="0.0.0.0"; x.acquiredDns=["8.8.8.8","1.1.1.1"];
  x.pppoeStatus="Connected"; x.dynamicStatus="Connected"; x.pppoeSessionId=`PPPoE-${String(hashText(x.name+x.pppoeUser)).padStart(6,"0").slice(-6)}`; x.linkStatus="Up";
  return x;
}
function disconnectDynamicInterface(x){
  if(x.addressingMode!=="Manual"){x.ip="0.0.0.0";x.mask="0.0.0.0";x.acquiredGateway="";x.acquiredDns=[];x.dynamicStatus="Disconnected";}
  if(x.addressingMode==="PPPoE"){x.pppoeStatus="Disconnected";x.pppoeSessionId="";}
  return x;
}
function hashText(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h;}

function syncInterfaceRoutes(x,old){
  const names=new Set([x.name,old?.name].filter(Boolean));
  state.routes=state.routes.filter(r=>!(names.has(r.interface)&&(r.connected||r.dynamic||r.generatedForInterface)));
  if(!x.enabled||x.addressingMode==="One-Arm Sniffer")return;
  if(isIPv4(x.ip)&&x.ip!=="0.0.0.0"&&isValidNetmask(x.mask)){
    state.routes.push({id:`connected-${x.id}`,destination:`${networkAddress(x.ip,x.mask)}/${maskToPrefix(x.mask)}`,gateway:"0.0.0.0",interface:x.name,distance:0,enabled:true,connected:true,type:"connected",generatedForInterface:x.name});
  }
  if(x.addressingMode==="DHCP"&&x.dynamicStatus==="Connected"&&x.dhcpDefaultRoute){
    state.routes.push({id:`dynamic-default-${x.id}`,destination:"0.0.0.0/0",gateway:x.acquiredGateway||"0.0.0.0",interface:x.name,distance:clamp(x.dhcpDistance,1,255),enabled:true,dynamic:true,type:"dhcp",generatedForInterface:x.name});
  }
  if(x.addressingMode==="PPPoE"&&x.pppoeStatus==="Connected"&&x.dhcpDefaultRoute){
    state.routes.push({id:`pppoe-default-${x.id}`,destination:"0.0.0.0/0",gateway:"0.0.0.0",interface:x.name,distance:clamp(x.dhcpDistance,1,255),enabled:true,dynamic:true,type:"pppoe",generatedForInterface:x.name});
  }
}
function reconcileAllGeneratedRoutes(){
  state.interfaces=state.interfaces.map(normalizeInterface);
  state.interfaces.forEach(i=>{
    if(i.addressingMode==="DHCP"&&i.enabled&&i.dynamicStatus!=="Connected") simulateDhcpAcquire(i);
    if(i.addressingMode==="PPPoE"&&i.enabled&&i.pppoeUser&&i.pppoePass&&i.pppoeStatus!=="Connected") simulatePppoeConnect(i);
  });
  state.routes=state.routes.filter(r=>!(r.dynamic||r.generatedForInterface));
  for(const i of state.interfaces) syncInterfaceRoutes(i,null);
  saveState();
}

function getRefCount(i){return Math.max(Number(i.ref||0),state.routes.filter(r=>r.interface===i.name&&!r.generatedForInterface).length+state.policies.filter(p=>p.from===i.name||p.to===i.name).length+state.interfaces.filter(x=>x.parent===i.name).length);}
function showReferences(i){const refs=[];state.routes.filter(r=>r.interface===i.name&&!r.generatedForInterface).forEach(r=>refs.push(`Static Route: ${r.destination}`));state.policies.filter(p=>p.from===i.name||p.to===i.name).forEach(p=>refs.push(`Firewall Policy: ${p.name}`));state.interfaces.filter(x=>x.parent===i.name).forEach(x=>refs.push(`Child Interface: ${x.name}`));openModal(`References - ${i.name}`,`<p><strong>${getRefCount(i)} reference(s)</strong></p>${refs.length?`<ul>${refs.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>`:"<p>No active simulator references.</p>"}`,[{label:"Close",className:"btn-secondary",action:closeModal}]);}
function deleteSelectedInterface(){const i=findInterface(selectedInterfaceId);if(!i)return;if(getRefCount(i)>0){showReferences(i);return;}if(!confirm(`Delete interface "${i.name}"?`))return;state.interfaces=state.interfaces.filter(x=>x.id!==i.id);state.routes=state.routes.filter(r=>r.interface!==i.name);selectedInterfaceId=null;saveState();renderAll();}

function updateRuntimeStatus(draft=findInterface(editingInterfaceId)||readEditorDraft(false)){
  if($("dhcp-client-runtime-status")){
    $("dhcp-client-runtime-status").textContent=draft.addressingMode==="DHCP"?(draft.dynamicStatus==="Connected"?`Status: Connected · IP ${draft.ip}/${draft.mask} · Gateway ${draft.acquiredGateway||"—"} · DNS ${(draft.acquiredDns||[]).join(", ")||"—"}`:"Status: Disconnected"):`DHCP client controls are available in DHCP addressing mode.`;
  }
  if($("pppoe-runtime-status")){
    $("pppoe-runtime-status").textContent=draft.addressingMode==="PPPoE"?(draft.pppoeStatus==="Connected"?`Status: Connected · Session ${draft.pppoeSessionId||"—"} · IP ${draft.ip}`:`Status: ${draft.pppoeStatus||"Disconnected"}`):`PPPoE controls are available in PPPoE addressing mode.`;
  }
  if($("dhcp-server-runtime-status")){
    const leases=(draft.dhcpLeases||[]).filter(l=>!l.expiresAt||l.expiresAt>Date.now());
    $("dhcp-server-runtime-status").textContent=draft.dhcpEnabled?(leases.length?`${leases.length} active lease(s): ${leases.map(l=>`${l.hostname} ${l.ip}`).join(" · ")}`:"0 active leases"):`DHCP server is disabled.`;
  }
}
function requireSavedEditingInterface(){const i=findInterface(editingInterfaceId);if(!i){alert("Save the interface first, then reopen it to test the live simulator action.");return null;}return i;}
function renewEditingDhcpClient(){const i=requireSavedEditingInterface();if(!i)return;if(i.addressingMode!=="DHCP"){alert("Set Addressing mode to DHCP first.");return;}simulateDhcpAcquire(i);syncInterfaceRoutes(i,i);saveState();renderAll();openInterfaceEditor(i);}
function releaseEditingDhcpClient(){const i=requireSavedEditingInterface();if(!i)return;if(i.addressingMode!=="DHCP"){alert("This interface is not a DHCP client.");return;}disconnectDynamicInterface(i);syncInterfaceRoutes(i,i);saveState();renderAll();openInterfaceEditor(i);}
function connectEditingPppoe(){const i=requireSavedEditingInterface();if(!i)return;if(i.addressingMode!=="PPPoE"){alert("Set Addressing mode to PPPoE first.");return;}i.pppoeUser=$("editor-pppoe-user").value;i.pppoePass=$("editor-pppoe-pass").value;if(!i.pppoeUser||!i.pppoePass){alert("PPPoE username and password are required.");return;}simulatePppoeConnect(i);syncInterfaceRoutes(i,i);saveState();renderAll();openInterfaceEditor(i);}
function disconnectEditingPppoe(){const i=requireSavedEditingInterface();if(!i)return;if(i.addressingMode!=="PPPoE"){alert("This interface is not PPPoE.");return;}disconnectDynamicInterface(i);syncInterfaceRoutes(i,i);saveState();renderAll();openInterfaceEditor(i);}
function simulateEditingDhcpLease(){
  const i=requireSavedEditingInterface();if(!i)return;if(!i.dhcpEnabled){alert("Enable and save the DHCP Server first.");return;}
  const lease=allocateDhcpLease(i);if(!lease){alert("No free DHCP addresses are available in the configured range.");return;}
  i.dhcpClients=String(i.dhcpLeases.length);saveState();renderAll();openInterfaceEditor(i);
}
function clearEditingDhcpLeases(){const i=requireSavedEditingInterface();if(!i)return;i.dhcpLeases=[];i.dhcpClients=i.dhcpEnabled?"0":"";saveState();renderAll();openInterfaceEditor(i);}
function allocateDhcpLease(i){
  i.dhcpLeases=(i.dhcpLeases||[]).filter(l=>!l.expiresAt||l.expiresAt>Date.now());
  if(!isIPv4(i.dhcpStart)||!isIPv4(i.dhcpEnd))return null;
  const used=new Set(i.dhcpLeases.map(l=>l.ip));
  for(let n=ipToInt(i.dhcpStart);n<=ipToInt(i.dhcpEnd);n++){
    const ip=intToIp(n); if(used.has(ip)||ip===i.ip||ip===i.dhcpGateway)continue;
    const seq=i.dhcpLeases.length+1, lease={ip,mac:`02:00:00:${hex2((n>>>16)&255)}:${hex2((n>>>8)&255)}:${hex2(n&255)}`,hostname:`client-${seq}`,expiresAt:Date.now()+i.dhcpLease*1000};
    i.dhcpLeases.push(lease);return lease;
  }
  return null;
}
function hex2(n){return Number(n).toString(16).padStart(2,"0");}

function bindDns(){
  $("dns-form")?.addEventListener("submit",e=>{e.preventDefault();saveDnsSettings();});
  $("dns-reset-button")?.addEventListener("click",renderDns);
  document.querySelectorAll('input[name="dns-mode"]').forEach(r=>r.addEventListener("change",updateDnsVisibility));
  ["dns-protocol-cleartext","dns-protocol-tls","dns-protocol-https","dns-interface-method"].forEach(id=>$(id)?.addEventListener("change",updateDnsVisibility));
  $("dns-test-button")?.addEventListener("click",runDnsTest);
  $("dns-clear-cache-button")?.addEventListener("click",clearDnsCache);
}

function renderDns(){
  if(!$("view-dns"))return;
  ensureDnsState();
  const d=state.dns;
  document.querySelectorAll('input[name="dns-mode"]').forEach(r=>r.checked=r.value===d.mode);
  $("dns-primary").value=d.primary; $("dns-secondary").value=d.secondary;
  $("dns-protocol-cleartext").checked=d.protocols.includes("Cleartext");
  $("dns-protocol-tls").checked=d.protocols.includes("TLS");
  $("dns-protocol-https").checked=d.protocols.includes("HTTPS");
  $("dns-hostname").value=d.serverHostname||""; $("dns-server-select").value=d.serverSelectMethod;
  $("dns-interface-method").value=d.interfaceSelectMethod; populateDnsInterfaces(d.interface);
  $("dns-source-ip").value=d.sourceIp; $("dns-timeout").value=d.timeout; $("dns-retry").value=d.retry;
  $("dns-cache-limit").value=d.cacheLimit; $("dns-cache-ttl").value=d.cacheTtl; $("dns-cache-notfound").checked=d.cacheNotFound;
  $("dns-form-errors").textContent="";
  updateDnsVisibility(); renderDnsStatus();
}

function populateDnsInterfaces(selected=""){
  if(!$("dns-interface"))return;
  $("dns-interface").innerHTML=state.interfaces.map(i=>`<option value="${esc(i.name)}" ${i.name===selected?"selected":""}>${esc(i.name)}</option>`).join("");
  if(selected&&findByName(selected))$("dns-interface").value=selected;
}

function currentDnsMode(){return document.querySelector('input[name="dns-mode"]:checked')?.value||"FortiGuard";}
function selectedDnsProtocols(){return ["Cleartext","TLS","HTTPS"].filter(p=>$(p==="Cleartext"?"dns-protocol-cleartext":p==="TLS"?"dns-protocol-tls":"dns-protocol-https")?.checked);}

function updateDnsVisibility(){
  if(!$("dns-primary"))return;
  const fortiguard=currentDnsMode()==="FortiGuard";
  if(fortiguard){
    $("dns-primary").value="96.45.45.45"; $("dns-secondary").value="96.45.46.46";
    $("dns-protocol-cleartext").checked=false; $("dns-protocol-tls").checked=true; $("dns-protocol-https").checked=false;
    $("dns-hostname").value="globalsdns.fortinet.net";
  }
  $("dns-primary").disabled=fortiguard; $("dns-secondary").disabled=fortiguard;
  $("dns-protocol-cleartext").disabled=fortiguard; $("dns-protocol-tls").disabled=fortiguard; $("dns-protocol-https").disabled=fortiguard;
  $("dns-hostname").disabled=fortiguard;
  const secure=selectedDnsProtocols().some(p=>p==="TLS"||p==="HTTPS");
  setHidden("field-dns-hostname",!secure);
  setHidden("field-dns-interface",$("dns-interface-method").value!=="Specify");
}

function readDnsForm(){
  const mode=currentDnsMode(), fortiguard=mode==="FortiGuard";
  return normalizeDns({
    ...state.dns,
    mode,
    primary:fortiguard?"96.45.45.45":$("dns-primary").value.trim(),
    secondary:fortiguard?"96.45.46.46":$("dns-secondary").value.trim(),
    protocols:fortiguard?["TLS"]:selectedDnsProtocols(),
    serverHostname:fortiguard?"globalsdns.fortinet.net":$("dns-hostname").value.trim(),
    serverSelectMethod:$("dns-server-select").value,
    interfaceSelectMethod:$("dns-interface-method").value,
    interface:$("dns-interface")?.value||"wan",
    sourceIp:$("dns-source-ip").value.trim()||"0.0.0.0",
    timeout:Number($("dns-timeout").value), retry:Number($("dns-retry").value),
    cacheLimit:Number($("dns-cache-limit").value), cacheTtl:Number($("dns-cache-ttl").value),
    cacheNotFound:$("dns-cache-notfound").checked
  });
}

function validateDns(d){
  const e=[];
  if(!isIPv4(d.primary))e.push("Primary DNS server must be a valid IPv4 address");
  if(d.secondary&&!isIPv4(d.secondary))e.push("Secondary DNS server must be a valid IPv4 address");
  if(!d.protocols.length)e.push("Select at least one DNS protocol");
  if((d.protocols.includes("TLS")||d.protocols.includes("HTTPS"))&&!d.serverHostname.trim())e.push("Server hostname is required for TLS/HTTPS simulation");
  if(d.timeout<1||d.timeout>10)e.push("Timeout must be 1-10 seconds");
  if(d.retry<0||d.retry>5)e.push("Retry must be 0-5");
  if(d.cacheLimit<0||!Number.isFinite(d.cacheLimit))e.push("Cache limit must be 0 or higher");
  if(d.cacheTtl<60||d.cacheTtl>86400)e.push("Cache TTL must be 60-86400 seconds");
  if(!isIPv4(d.sourceIp))e.push("Source IP must be a valid IPv4 address");
  if(d.interfaceSelectMethod==="Specify"&&!findByName(d.interface))e.push("Select a valid outgoing interface");
  return e;
}

function saveDnsSettings(){
  const d=readDnsForm(), errors=validateDns(d);
  if(errors.length){$("dns-form-errors").textContent=errors.join(" • ");return;}
  state.dns=d; saveState(); renderDns();
  $("dns-test-result").textContent="DNS settings applied.";
}

function dnsServersInUse(d=state.dns){
  return [{label:"Primary",ip:d.primary},{label:"Secondary",ip:d.secondary}].filter(s=>isIPv4(s.ip)&&s.ip!=="0.0.0.0");
}

function dnsRouteStatus(server,d=state.dns){
  const route=findBestRoute(server.ip);
  if(!route)return {ok:false,route:null,reason:"No route"};
  if(d.interfaceSelectMethod==="Specify"&&route.interface!==d.interface)return {ok:false,route,reason:`Route uses ${route.interface}, not ${d.interface}`};
  return {ok:true,route,reason:"Reachable"};
}

function simulatedDnsAnswer(name){
  const known={"www.example.com":"93.184.216.34","example.com":"93.184.216.34"};
  if(known[name])return known[name];
  const h=hashText(name);return `203.0.113.${(h%253)+1}`;
}

function resolveDnsName(name,options={record:true}){
  ensureDnsState();
  const d=state.dns, domain=String(name||"").trim().toLowerCase().replace(/\.$/,"");
  if(!domain)return {ok:false,reason:"Domain is required"};
  if(isIPv4(domain))return {ok:true,name:domain,ip:domain,server:"Local",protocol:"IP",rtt:0,cached:false};
  const cached=d.cache[domain];
  if(cached&&cached.expiresAt>Date.now())return {ok:true,name:domain,ip:cached.ip,server:"Cache",protocol:"Cache",rtt:0,cached:true};
  if(cached)delete d.cache[domain];
  const servers=dnsServersInUse(d);
  if(!servers.length)return {ok:false,reason:"No DNS servers configured"};
  const ordered=d.serverSelectMethod==="Failover"?servers:servers.slice().sort((a,b)=>simulatedRtt(a.ip)-simulatedRtt(b.ip));
  const protocol=d.protocols[0]||"Cleartext";
  for(const server of ordered){
    const reach=dnsRouteStatus(server,d); if(!reach.ok)continue;
    const ip=simulatedDnsAnswer(domain), rtt=simulatedRtt(server.ip);
    const limit=Math.max(0,Number(d.cacheLimit)||0);
    if(limit>0){
      const entries=Object.keys(d.cache); if(entries.length>=limit)delete d.cache[entries[0]];
      d.cache[domain]={ip,expiresAt:Date.now()+d.cacheTtl*1000};
    }
    const result={ok:true,name:domain,ip,server:server.ip,serverLabel:server.label,protocol,rtt,cached:false,route:reach.route};
    if(options.record!==false){d.queryHistory.push({...result,time:Date.now()});d.queryHistory=d.queryHistory.slice(-20);saveState();}
    return result;
  }
  const result={ok:false,reason:"Configured DNS servers are not reachable through the routing table"};
  if(options.record!==false){d.queryHistory.push({...result,name:domain,time:Date.now()});d.queryHistory=d.queryHistory.slice(-20);saveState();}
  return result;
}

function simulatedRtt(ip){return 8+(hashText(ip)%38);}
function runDnsTest(){
  const domain=$("dns-test-name").value.trim(), result=resolveDnsName(domain);
  if(result.ok)$("dns-test-result").textContent=`RESOLVED · ${result.name} → ${result.ip} · ${result.cached?"Cache":`${result.serverLabel} ${result.server}`} · ${result.protocol} · ${result.rtt} ms`;
  else $("dns-test-result").textContent=`FAILED · ${result.reason}`;
  renderDnsStatus();
}
function clearDnsCache(){ensureDnsState();state.dns.cache={};saveState();if($("dns-test-result"))$("dns-test-result").textContent="DNS cache cleared.";renderDnsStatus();}
function renderDnsStatus(){
  const body=$("dns-status-body");if(!body)return;body.innerHTML="";
  const d=state.dns, protocol=d.protocols.join(", ")||"-";
  dnsServersInUse(d).forEach(server=>{
    const reach=dnsRouteStatus(server,d),tr=document.createElement("tr");
    tr.innerHTML=`<td>${esc(server.label)}</td><td>${esc(server.ip)}</td><td>${esc(protocol)}</td><td>${reach.route?`${esc(reach.route.destination)} via ${esc(reach.route.interface)}`:"-"}</td><td class="${reach.ok?"status-enabled":"status-down"}">${reach.ok?"● Reachable":"● Unreachable"}</td><td>${reach.ok?`${simulatedRtt(server.ip)} ms`:"-"}</td>`;body.append(tr);
  });
}

function bindRoutes(){$("route-create-button")?.addEventListener("click",openRouteModal);$("route-delete-button")?.addEventListener("click",deleteRoute);}
function renderRoutes(){const b=$("routes-table-body");if(!b)return;b.innerHTML="";state.routes.slice().sort(routeSort).forEach(r=>{const tr=document.createElement("tr");if(r.id===selectedRouteId)tr.classList.add("selected");const code=r.connected?"C":r.dynamic?"D":"S", detail=r.type&&r.type!=="static"?` <span class="muted">(${esc(r.type)})</span>`:"";tr.innerHTML=`<td><strong>${code}</strong> ${esc(r.destination)}${detail}</td><td>${esc(r.gateway)}</td><td>▣ ${esc(r.interface)}</td><td>${r.distance}</td><td class="${r.enabled?"status-enabled":"status-down"}">${r.enabled?"● Enabled":"● Disabled"}</td>`;tr.addEventListener("click",()=>{selectedRouteId=r.id;renderRoutes();updateButtons();});b.append(tr);});updateButtons();}
function routeSort(a,b){const pa=Number(a.destination.split("/")[1]||0),pb=Number(b.destination.split("/")[1]||0);return pb-pa||a.distance-b.distance||a.interface.localeCompare(b.interface);}
function openRouteModal(){openModal("Create Static Route",`<div class="form-grid"><div class="field"><label>Destination</label><input id="route-destination" value="0.0.0.0/0"></div><div class="field"><label>Gateway</label><input id="route-gateway" value="192.168.80.1"></div><div class="field"><label>Interface</label><select id="route-interface">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join("")}</select></div><div class="field"><label>Administrative Distance</label><input id="route-distance" type="number" min="1" max="255" value="10"></div></div>`,[{label:"Cancel",className:"btn-secondary",action:closeModal},{label:"Create",className:"btn-primary",action:saveRoute}]);}
function saveRoute(){const d=$("route-destination").value.trim(),g=$("route-gateway").value.trim(),iface=$("route-interface").value,dist=Number($("route-distance").value||10);if(!isCIDR(d)||!isIPv4(g)){alert("Enter a valid destination CIDR and gateway.");return;}if(!findByName(iface)){alert("Select a valid interface.");return;}if(dist<1||dist>255){alert("Administrative distance must be 1-255.");return;}state.routes.push({id:uid(),destination:d,gateway:g,interface:iface,distance:dist,enabled:true,type:"static"});saveState();closeModal();renderRoutes();}
function deleteRoute(){const r=state.routes.find(x=>x.id===selectedRouteId);if(!r)return;if(r.connected||r.dynamic){alert("Connected and dynamic routes are managed by interface configuration.");return;}if(confirm(`Delete route ${r.destination}?`)){state.routes=state.routes.filter(x=>x.id!==r.id);selectedRouteId=null;saveState();renderRoutes();}}

function bindPolicies(){$("policy-create-button")?.addEventListener("click",openPolicyModal);$("policy-delete-button")?.addEventListener("click",deletePolicy);$("test-traffic-button")?.addEventListener("click",openTrafficModal);}
function renderPolicies(){const b=$("policies-table-body");if(!b)return;b.innerHTML="";state.policies.forEach(p=>{const tr=document.createElement("tr");if(p.uid===selectedPolicyUid)tr.classList.add("selected");tr.innerHTML=`<td>${p.id}</td><td><strong>${esc(p.name)}</strong></td><td>▣ ${esc(p.from)}</td><td>▣ ${esc(p.to)}</td><td>${esc(p.source)}</td><td>${esc(p.destination)}</td><td>${esc(p.service)}</td><td class="${p.action==="ACCEPT"?"status-accept":"status-deny"}">${p.action==="ACCEPT"?"✓":"✕"} ${p.action}</td><td class="${p.nat?"status-accept":"status-deny"}">${p.nat?"● Yes":"✕ No"}</td>`;tr.addEventListener("click",()=>{selectedPolicyUid=p.uid;renderPolicies();updateButtons();});b.append(tr);});updateButtons();}
function openPolicyModal(){const opts=["all",...state.interfaces.map(i=>i.name)].map(x=>`<option>${esc(x)}</option>`).join("");openModal("Create Firewall Policy",`<div class="form-grid"><div class="field"><label>Name</label><input id="policy-name" value="New-Policy"></div><div class="field"><label>Action</label><select id="policy-action"><option>ACCEPT</option><option>DENY</option></select></div><div class="field"><label>Incoming Interface</label><select id="policy-from">${opts}</select></div><div class="field"><label>Outgoing Interface</label><select id="policy-to">${opts}</select></div><div class="field"><label>Source</label><input id="policy-source" value="all"></div><div class="field"><label>Destination</label><input id="policy-destination" value="all"></div><div class="field"><label>Service</label><select id="policy-service"><option>ALL</option><option>PING</option><option>HTTP</option><option>HTTPS</option><option>DNS</option><option>RDP</option></select></div><div class="field"><label>NAT</label><select id="policy-nat"><option value="true">ON</option><option value="false">OFF</option></select></div></div>`,[{label:"Cancel",className:"btn-secondary",action:closeModal},{label:"Create",className:"btn-primary",action:savePolicy}]);}
function savePolicy(){const id=Math.max(0,...state.policies.map(p=>p.id))+1;const p={id,uid:uid(),name:$("policy-name").value.trim()||`Policy-${id}`,from:$("policy-from").value,to:$("policy-to").value,source:$("policy-source").value.trim()||"all",destination:$("policy-destination").value.trim()||"all",service:$("policy-service").value,action:$("policy-action").value,nat:$("policy-nat").value==="true",enabled:true};const denyIndex=state.policies.findIndex(x=>x.name==="Deny-ALL");state.policies.splice(denyIndex<0?state.policies.length:denyIndex,0,p);saveState();closeModal();renderAll();}
function deletePolicy(){const p=state.policies.find(x=>x.uid===selectedPolicyUid);if(p&&confirm(`Delete policy "${p.name}"?`)){state.policies=state.policies.filter(x=>x.uid!==p.uid);selectedPolicyUid=null;saveState();renderAll();}}

function bindLogs(){$("generate-log-button")?.addEventListener("click",openTrafficModal);$("clear-logs-button")?.addEventListener("click",()=>{state.logs=[];saveState();renderAll();});}
function renderLogs(){const b=$("logs-table-body");if(!b)return;b.innerHTML="";[...state.logs].reverse().forEach(l=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(l.time)}</td><td class="${l.action==="ACCEPT"?"status-accept":"status-deny"}">${l.action==="ACCEPT"?"✓":"✕"} ${l.action}</td><td>${esc(String(l.policy))}</td><td>${esc(l.source)}</td><td>${esc(l.destination)}</td><td>${esc(l.service)}</td><td>${esc(l.reason)}</td>`;b.append(tr);});}
function openTrafficModal(){openModal("Test Traffic",`<div class="form-grid"><div class="field"><label>Source IP</label><input id="test-source" value="192.168.1.50"></div><div class="field"><label>Destination IP</label><input id="test-destination" value="8.8.8.8"></div><div class="field"><label>Incoming Interface</label><select id="test-incoming">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join("")}</select></div><div class="field"><label>Expected Outgoing Interface</label><select id="test-outgoing">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join("")}</select></div><div class="field"><label>Service</label><select id="test-service"><option>PING</option><option>HTTP</option><option>HTTPS</option><option>DNS</option><option>RDP</option></select></div><div class="field"><label>Simulator Logic</label><div class="muted">Incoming → Route lookup → Actual outgoing → Policy → NAT → Log</div></div></div>`,[{label:"Cancel",className:"btn-secondary",action:closeModal},{label:"Run Test",className:"btn-primary",action:runTraffic}]);if(findByName("lan"))$("test-incoming").value="lan";if(findByName("wan"))$("test-outgoing").value="wan";}
function runTraffic(){const source=$("test-source").value.trim(),destination=$("test-destination").value.trim(),incoming=$("test-incoming").value,outgoing=$("test-outgoing").value,service=$("test-service").value;if(!isIPv4(source)||!isIPv4(destination)){alert("Enter valid source and destination IPv4 addresses.");return;}const r=evaluateTraffic({source,destination,incoming,outgoing,service});state.logs.push({id:uid(),time:new Date().toLocaleTimeString(),action:r.action,policy:r.policyId,source,destination,service,reason:r.reason});state.logs=state.logs.slice(-200);saveState();closeModal();renderAll();alert(`${r.action}\n${r.reason}`);}
function evaluateTraffic({source,destination,incoming,outgoing,service}){
  const inIf=findByName(incoming); if(!inIf)return{action:"DENY",policyId:"-",reason:"Incoming interface does not exist"};
  if(!isInterfaceOperational(inIf))return{action:"DENY",policyId:"-",reason:`Incoming interface ${incoming} is down or disconnected`};
  if(inIf.addressingMode==="One-Arm Sniffer")return{action:"DENY",policyId:"-",reason:"One-Arm Sniffer interfaces do not route traffic"};
  const returnRoute=findBestRoute(source); if(returnRoute&&returnRoute.interface!==incoming)return{action:"DENY",policyId:"-",reason:`Reverse path check failed: source ${source} is reachable through ${returnRoute.interface}, not ${incoming}`};
  const route=findBestRoute(destination);if(!route)return{action:"DENY",policyId:"-",reason:"No route to destination"};
  const actualOutgoing=route.interface; if(outgoing&&outgoing!==actualOutgoing)return{action:"DENY",policyId:"-",reason:`Route lookup selected ${actualOutgoing}, not ${outgoing}`};
  const outIf=findByName(actualOutgoing); if(!outIf||!isInterfaceOperational(outIf))return{action:"DENY",policyId:"-",reason:`Outgoing interface ${actualOutgoing} is down or disconnected`};
  if(outIf.addressingMode==="One-Arm Sniffer")return{action:"DENY",policyId:"-",reason:"One-Arm Sniffer interfaces do not forward traffic"};
  const p=state.policies.find(p=>p.enabled&&(p.from===incoming||p.from==="all")&&(p.to===actualOutgoing||p.to==="all")&&(p.service===service||p.service==="ALL"));
  if(!p)return{action:"DENY",policyId:"-",reason:`Implicit deny: no policy from ${incoming} to ${actualOutgoing} for ${service}`};
  if(p.action==="DENY")return{action:"DENY",policyId:p.id,reason:`Denied by policy ${p.name}`};
  if(outIf.role==="WAN"&&!p.nat)return{action:"DENY",policyId:p.id,reason:"Policy matched but source NAT is disabled for WAN traffic"};
  return{action:"ACCEPT",policyId:p.id,reason:`Policy ${p.name} matched; route ${route.destination} via ${actualOutgoing}${outIf.role==="WAN"&&p.nat?"; source NAT applied":""}`};
}
function isInterfaceOperational(i){if(!i||!i.enabled||i.linkStatus==="Down")return false;if(i.addressingMode==="DHCP")return i.dynamicStatus==="Connected"&&isIPv4(i.ip)&&i.ip!=="0.0.0.0";if(i.addressingMode==="PPPoE")return i.pppoeStatus==="Connected"&&isIPv4(i.ip)&&i.ip!=="0.0.0.0";return true;}
function findBestRoute(ip){return state.routes.filter(r=>r.enabled&&cidrContains(r.destination,ip)&&isRouteUsable(r)).sort(routeSort)[0]||null;}
function isRouteUsable(r){const i=findByName(r.interface);return !!i&&isInterfaceOperational(i);}
function evaluateLocalPing(ip){const route=findBestRoute(ip);if(!route)return{action:"DENY",reason:"No route to destination"};const outIf=findByName(route.interface);if(!isInterfaceOperational(outIf))return{action:"DENY",reason:`Interface ${route.interface} is down`};return{action:"ACCEPT",reason:`Route ${route.destination} via ${route.interface}`,outgoing:route.interface,source:outIf.ip};}

function renderDashboard(){const mini=(h,rows)=>`<table class="data-table"><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${esc(String(x))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;if($("interfaces-summary-body"))$("interfaces-summary-body").innerHTML=mini(["Name","IP/Netmask","Access"],state.interfaces.slice(0,5).map(i=>[i.name,`${i.ip}/${i.mask}`,(i.access||[]).slice(0,3).join(" ")]));if($("policy-summary-body"))$("policy-summary-body").innerHTML=mini(["ID","Name","From","To","Action","NAT"],state.policies.slice(0,5).map(p=>[p.id,p.name,p.from,p.to,p.action,p.nat?"Yes":"No"]));if($("log-summary-body"))$("log-summary-body").innerHTML=mini(["Time","Action","Source","Destination"],[...state.logs].slice(-6).reverse().map(l=>[l.time,l.action,l.source,l.destination]));if($("topology-wan-ip"))$("topology-wan-ip").textContent=findByName("wan")?.ip||"—";if($("topology-lan-ip"))$("topology-lan-ip").textContent=findByName("lan")?.ip||"—";if($("topology-dmz-ip"))$("topology-dmz-ip").textContent=findByName("dmz")?.ip||"—";}
function renderAll(){renderInterfaces();renderDns();renderRoutes();renderPolicies();renderLogs();renderDashboard();}
function updateButtons(){if($("interface-edit-button"))$("interface-edit-button").disabled=!selectedInterfaceId;if($("interface-delete-button"))$("interface-delete-button").disabled=!selectedInterfaceId;if($("interface-integrate-button"))$("interface-integrate-button").disabled=true;if($("route-delete-button"))$("route-delete-button").disabled=!selectedRouteId;if($("policy-delete-button"))$("policy-delete-button").disabled=!selectedPolicyUid;}

function bindModal(){$("modal-close-button")?.addEventListener("click",closeModal);$("modal-backdrop")?.addEventListener("click",e=>{if(e.target===$("modal-backdrop"))closeModal();});document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();if($("cli-panel"))$("cli-panel").hidden=true;}});}
function openModal(title,html,actions){$("modal-title").textContent=title;$("modal-body").innerHTML=html;$("modal-actions").innerHTML="";actions.forEach(a=>{const b=document.createElement("button");b.className=a.className;b.textContent=a.label;b.addEventListener("click",a.action);$("modal-actions").append(b);});$("modal-backdrop").hidden=false;}
function closeModal(){if(!$("modal-backdrop"))return;$("modal-backdrop").hidden=true;$("modal-body").innerHTML="";$("modal-actions").innerHTML="";}

function bindCli(){$("cli-open-button")?.addEventListener("click",()=>{$("cli-panel").hidden=false;$("cli-input").focus();});$("cli-close-button")?.addEventListener("click",()=>$("cli-panel").hidden=true);$("cli-input")?.addEventListener("keydown",e=>{if(e.key==="Enter"){const c=$("cli-input").value.trim();$("cli-input").value="";runCli(c);}});}
function cli(t){$("cli-output").textContent+=`\n${t}`;$("cli-output").scrollTop=$("cli-output").scrollHeight;}
function runCli(c){
  if(!c)return;cli(`FG-SIM-01 # ${c}`);const n=c.toLowerCase();
  if(n==="get router info routing-table all"){
    cli("Routing table (simulated)");state.routes.slice().sort(routeSort).forEach(r=>cli(`${r.connected?"C":r.dynamic?"S*":"S"} ${r.destination} [${r.distance}/0] via ${r.gateway}, ${r.interface}${r.type?` (${r.type})`:""}`));
  }else if(n==="get system interface physical"){
    cli("Physical interface status (simulated)");state.interfaces.filter(i=>i.type==="Physical Interface").forEach(i=>cli(`${i.name}: ${isInterfaceOperational(i)?"up":"down"} mode=${i.addressingMode.toLowerCase()} ip=${i.ip}/${i.mask}${i.addressingMode==="DHCP"?` dhcp=${i.dynamicStatus}`:""}${i.addressingMode==="PPPoE"?` pppoe=${i.pppoeStatus}`:""}`));
  }else if(n==="diagnose ip address list"){
    state.interfaces.filter(i=>isIPv4(i.ip)&&i.ip!=="0.0.0.0").forEach(i=>cli(`${i.name}: ${i.ip}/${maskToPrefix(i.mask)} (${i.addressingMode})`));
  }else if(n==="show system dns"){
    ensureDnsState();const d=state.dns;cli(`config system dns\n    set primary ${d.primary}\n    set secondary ${d.secondary}\n    set protocol ${d.protocols.map(p=>p==="Cleartext"?"cleartext":p==="TLS"?"dot":"doh").join(" ")}\n    set server-hostname \"${d.serverHostname}\"\n    set timeout ${d.timeout}\n    set retry ${d.retry}\n    set dns-cache-limit ${d.cacheLimit}\n    set dns-cache-ttl ${d.cacheTtl}\n    set interface-select-method ${d.interfaceSelectMethod.toLowerCase().replace("-","")}\nend`);
  }else if(n.startsWith("execute ping ")){
    const target=c.split(/\s+/).pop();let ip=target,dnsResult=null;
    if(!isIPv4(target)){dnsResult=resolveDnsName(target,{record:false});if(!dnsResult.ok){cli(`PING ${target}: DNS lookup failed\nReason: ${dnsResult.reason}`);cli("");return;}ip=dnsResult.ip;cli(`Resolving ${target} -> ${ip} via ${dnsResult.server}`);}
    const r=evaluateLocalPing(ip);cli(r.action==="ACCEPT"?`PING ${target} (${ip}): 56 data bytes\n64 bytes from ${ip}: icmp_seq=0 ttl=117 time=12.4 ms\n--- ${target} ping statistics ---\n1 packets transmitted, 1 packets received, 0% packet loss\nRoute: ${r.reason}`:`PING ${target}: timeout\nReason: ${r.reason}`);
  }else if(n.startsWith("diagnose sniffer packet")){
    const r=evaluateLocalPing("8.8.8.8"),out=r.outgoing||"wan",src=r.source||"0.0.0.0";cli(`interfaces=[any]\nfilters=[simulated]\n0.000000 ${out} out ${src} -> 8.8.8.8: icmp echo request\n0.012400 ${out} in 8.8.8.8 -> ${src}: icmp echo reply`);
  }else if(n==="clear"){$("cli-output").textContent="";}
  else if(n==="help"||n==="?"){cli("get router info routing-table all\nget system interface physical\ndiagnose ip address list\nshow system dns\nexecute ping <ip-or-hostname>\ndiagnose sniffer packet any 'host <ip>' 4 0 l\nclear");}
  else cli('Command fail. Return code -61\nType "help" for supported simulator commands.');
  cli("");
}

function loadState(){
  try{
    if(typeof localStorage==="undefined")return structuredClone(defaultState);
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return structuredClone(defaultState);
    const p=JSON.parse(raw);if(!p||![p.interfaces,p.routes,p.policies,p.logs].every(Array.isArray))return structuredClone(defaultState);
    p.interfaces=p.interfaces.map(normalizeInterface);
    if(!p.interfaces.some(i=>i.name==="fortilink"))p.interfaces.unshift(structuredClone(defaultState.interfaces[0]));
    if(!p.routes.some(r=>r.interface==="fortilink"&&r.connected))p.routes.push(structuredClone(defaultState.routes[1]));
    p.routes=p.routes.map(r=>({...r,type:r.type||(r.connected?"connected":r.dynamic?"dynamic":"static")}));
    p.dns=normalizeDns(p.dns);
    return p;
  }catch{return structuredClone(defaultState);}
}
function saveState(){if(typeof localStorage!=="undefined")localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function isIPv4(v){const a=String(v).split(".");return a.length===4&&a.every(x=>/^\d+$/.test(x)&&+x>=0&&+x<=255);}
function ipToInt(ip){return ip.split(".").reduce((n,x)=>((n<<8)+Number(x))>>>0,0)>>>0;}
function intToIp(n){return [24,16,8,0].map(s=>(n>>>s)&255).join(".");}
function isValidNetmask(m){if(!isIPv4(m))return false;const inv=(~ipToInt(m))>>>0;return ((inv+1)&inv)===0;}
function maskToPrefix(m){return isValidNetmask(m)?m.split(".").reduce((n,x)=>n+(Number(x).toString(2).match(/1/g)||[]).length,0):0;}
function networkAddress(ip,m){const n=(ipToInt(ip)&ipToInt(m))>>>0;return intToIp(n);}
function broadcastAddress(ip,m){const n=(ipToInt(ip)&ipToInt(m))>>>0,inv=(~ipToInt(m))>>>0;return intToIp((n|inv)>>>0);}
function isNetworkOrBroadcast(candidate,ip,m){return candidate===networkAddress(ip,m)||candidate===broadcastAddress(ip,m);}
function sameSubnet(a,b,m){return networkAddress(a,m)===networkAddress(b,m);}
function subnetsOverlap(a,ma,b,mb){const p=Math.min(maskToPrefix(ma),maskToPrefix(mb)),m=p===0?0:(0xffffffff<<(32-p))>>>0;return (ipToInt(a)&m)===(ipToInt(b)&m);}
function isCIDR(v){const [ip,p]=v.split("/");return isIPv4(ip)&&/^\d+$/.test(p||"")&&+p>=0&&+p<=32;}
function cidrContains(cidr,ip){if(!isCIDR(cidr)||!isIPv4(ip))return false;const [net,p]=cidr.split("/"),mask=+p===0?0:(0xffffffff<<(32-+p))>>>0;return (ipToInt(net)&mask)===(ipToInt(ip)&mask);}
function clamp(n,min,max){return Math.max(min,Math.min(max,Number(n)||min));}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

if(typeof globalThis!=="undefined") globalThis.__FG_SIM_TEST__={
  defaultState,baseDns,normalizeDns,validateDns,resolveDnsName,dnsRouteStatus,dnsServersInUse,
  normalizeInterface,validateInterface,simulateDhcpAcquire,simulatePppoeConnect,disconnectDynamicInterface,
  syncInterfaceRoutes,evaluateTraffic,evaluateLocalPing,findBestRoute,allocateDhcpLease,isIPv4,isValidNetmask,networkAddress,broadcastAddress,cidrContains,
  getState:()=>state,setState:s=>{state=s;ensureDnsState();}
};
