const STORAGE_KEY = "fortigate-simulator-v1";
const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID();

const baseInterface = {
  alias:"", role:"LAN", addressingMode:"Manual", members:"", parent:"", vlanId:null,
  access:[], dhcpEnabled:false, dhcpClients:"", dhcpStart:"", dhcpEnd:"", dhcpRange:"",
  dhcpNetmask:"255.255.255.0", dhcpGateway:"", dhcpDns:"Same as System DNS", dhcpLease:86400,
  createAddressObject:true, secondaryEnabled:false, secondaryIp:"", secondaryMask:"",
  deviceDetection:true, bandwidthUp:0, bandwidthDown:0, dhcpDefaultRoute:true, dhcpDistance:5,
  pppoeUser:"", pppoePass:"", ref:0, enabled:true, linkStatus:"Up"
};

const defaultState = {
  interfaces:[
    {...baseInterface,id:"if-fortilink",group:"802.3ad Aggregate",name:"fortilink",type:"802.3ad Aggregate",ip:"10.255.1.1",mask:"255.255.255.0",access:["PING","Security Fabric Connection"],dhcpEnabled:true,dhcpStart:"10.255.1.2",dhcpEnd:"10.255.1.254",dhcpRange:"10.255.1.2-10.255.1.254",dhcpGateway:"10.255.1.1",ref:2},
    {...baseInterface,id:"if-wan",group:"Physical Interface",name:"wan",type:"Physical Interface",role:"WAN",ip:"192.168.80.49",mask:"255.255.255.0",access:["PING","HTTPS","SSH","HTTP"],createAddressObject:false,deviceDetection:false,bandwidthUp:100,bandwidthDown:500,ref:13},
    {...baseInterface,id:"if-internal2",group:"Physical Interface",name:"internal2",type:"Physical Interface",ip:"192.168.20.1",mask:"255.255.255.0",access:["PING","HTTPS","SSH","HTTP"],dhcpGateway:"192.168.20.1",ref:3},
    {...baseInterface,id:"if-dsl",group:"Physical Interface",name:"dsl",type:"Physical Interface",role:"WAN",addressingMode:"DHCP",ip:"0.0.0.0",mask:"0.0.0.0",access:["PING","FMG-Access"],createAddressObject:false,deviceDetection:false,enabled:false,linkStatus:"Down",ref:1},
    {...baseInterface,id:"if-dmz",group:"Physical Interface",name:"dmz",type:"Physical Interface",role:"DMZ",ip:"10.10.10.1",mask:"255.255.255.0",access:["PING","HTTPS","FMG-Access"],dhcpGateway:"10.10.10.1",deviceDetection:false,linkStatus:"Down"},
    {...baseInterface,id:"if-lan",group:"Software Switch",name:"lan",type:"Software Switch",members:"internal",ip:"192.168.1.99",mask:"255.255.255.0",access:["PING","HTTPS","SSH","HTTP","Security Fabric Connection"],dhcpEnabled:true,dhcpClients:"2",dhcpStart:"192.168.1.50",dhcpEnd:"192.168.1.150",dhcpRange:"192.168.1.50-192.168.1.150",dhcpGateway:"192.168.1.99",ref:13}
  ],
  routes:[
    {id:"rt-default",destination:"0.0.0.0/0",gateway:"192.168.80.1",interface:"wan",distance:10,enabled:true},
    {id:"rt-fortilink",destination:"10.255.1.0/24",gateway:"0.0.0.0",interface:"fortilink",distance:0,enabled:true,connected:true},
    {id:"rt-internal2",destination:"192.168.20.0/24",gateway:"0.0.0.0",interface:"internal2",distance:0,enabled:true,connected:true},
    {id:"rt-lan",destination:"192.168.1.0/24",gateway:"0.0.0.0",interface:"lan",distance:0,enabled:true,connected:true},
    {id:"rt-dmz",destination:"10.10.10.0/24",gateway:"0.0.0.0",interface:"dmz",distance:0,enabled:true,connected:true}
  ],
  policies:[
    {id:1,uid:"pol-1",name:"LAN-to-WAN",from:"lan",to:"wan",source:"LAN_Subnet",destination:"all",service:"ALL",action:"ACCEPT",nat:true,enabled:true},
    {id:2,uid:"pol-2",name:"LAN-to-DMZ",from:"lan",to:"dmz",source:"LAN_Subnet",destination:"DMZ_Subnet",service:"ALL",action:"ACCEPT",nat:false,enabled:true},
    {id:3,uid:"pol-3",name:"Deny-ALL",from:"all",to:"all",source:"all",destination:"all",service:"ALL",action:"DENY",nat:false,enabled:true}
  ],
  logs:[{id:uid(),time:new Date().toLocaleTimeString(),action:"ACCEPT",policy:1,source:"192.168.1.50",destination:"8.8.8.8",service:"PING",reason:"Policy matched; NAT applied"}]
};

let state = loadState();
let selectedInterfaceId=null, selectedRouteId=null, selectedPolicyUid=null, editingInterfaceId=null;

function init(){
  bindNavigation(); bindInterfaces(); bindRoutes(); bindPolicies(); bindLogs(); bindModal(); bindCli();
  $("sidebar-toggle").addEventListener("click",()=>$("sidebar").classList.toggle("mobile-open"));
  renderAll();
}

document.addEventListener("DOMContentLoaded",init);

function bindNavigation(){
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{
    if(b.dataset.view==="placeholder") $("placeholder-title").textContent=b.dataset.title||"Module";
    showView(b.dataset.view);
  }));
  $("nav-network").addEventListener("click",()=>$("network-subnav").hidden=!$("network-subnav").hidden);
}

function showView(name){
  document.querySelectorAll(".app-view").forEach(v=>v.classList.remove("active-view"));
  document.querySelectorAll(".nav-item,.subnav-item").forEach(v=>v.classList.remove("active"));
  const target=$(`view-${name}`)||$("view-placeholder"); target.classList.add("active-view");
  const nav=document.querySelector(`[data-view="${name}"]`); if(nav) nav.classList.add("active");
  if(innerWidth<=760) $("sidebar").classList.remove("mobile-open");
}

function bindInterfaces(){
  $("interface-create-button").addEventListener("click",e=>{e.stopPropagation();const m=$("interface-create-menu");m.hidden=!m.hidden;$("interface-create-button").setAttribute("aria-expanded",String(!m.hidden));});
  document.querySelectorAll("[data-create-interface]").forEach(b=>b.addEventListener("click",()=>{ $("interface-create-menu").hidden=true; openInterfaceEditor(null,b.dataset.createInterface); }));
  document.addEventListener("click",e=>{if(!$("interface-create-wrap").contains(e.target)) $("interface-create-menu").hidden=true;});
  $("interface-edit-button").addEventListener("click",()=>{const x=findInterface(selectedInterfaceId);if(x)openInterfaceEditor(x);});
  $("interface-delete-button").addEventListener("click",deleteSelectedInterface);
  $("interface-search").addEventListener("input",renderInterfaces);
  $("interface-group-select").addEventListener("change",renderInterfaces);
  $("interface-search-button").addEventListener("click",()=>$("interface-search").focus());
  $("interface-editor-form").addEventListener("submit",e=>{e.preventDefault();saveInterfaceEditor();});
  $("interface-editor-cancel").addEventListener("click",closeInterfaceEditor);
  $("interface-editor-cancel-top").addEventListener("click",closeInterfaceEditor);
  $("editor-type").addEventListener("change",updateEditorVisibility);
  $("editor-role").addEventListener("change",updateEditorVisibility);
  document.querySelectorAll('input[name="editor-address-mode"]').forEach(r=>r.addEventListener("change",updateEditorVisibility));
  $("editor-secondary-enabled").addEventListener("change",updateEditorVisibility);
  $("editor-dhcp-enabled").addEventListener("change",()=>{syncDhcpDefaults();updateEditorVisibility();});
  $("editor-ip").addEventListener("change",syncDhcpDefaults);
  $("editor-mask").addEventListener("change",syncDhcpDefaults);
  $("admin-http").addEventListener("change",()=>{if($("admin-http").checked) $("admin-https").checked=true;});
  $("admin-https").addEventListener("change",()=>{if(!$("admin-https").checked) $("admin-http").checked=false;});
}

function renderInterfaces(){
  const body=$("interfaces-table-body"), q=$("interface-search").value.trim().toLowerCase(), group=$("interface-group-select").value;
  body.innerHTML=""; let last="";
  const items=state.interfaces.filter(i=>[i.name,i.type,i.members,i.ip,i.alias,i.role].join(" ").toLowerCase().includes(q));
  items.forEach(i=>{
    if(group==="type"&&i.group!==last){const g=document.createElement("tr");g.className="group-row";g.innerHTML=`<td colspan="8">⊟ ${esc(i.group)} <span class="status-chip">${items.filter(x=>x.group===i.group).length}</span></td>`;body.append(g);last=i.group;}
    const tr=document.createElement("tr"); if(i.id===selectedInterfaceId) tr.classList.add("selected");
    const access=(i.access||[]).map(a=>`<span class="access-chip">${esc(a)}</span>`).join("");
    const ref=getRefCount(i);
    tr.innerHTML=`<td>${i.enabled?"▣":"▤"} <strong>${esc(i.name)}</strong>${i.alias?`<div class="muted">${esc(i.alias)}</div>`:""}</td><td>${esc(i.type)}</td><td>${esc(i.members||"")}</td><td>${esc(i.ip)}/${esc(i.mask)}</td><td>${access||"-"}</td><td>${esc(i.dhcpClients||"")}</td><td>${esc(i.dhcpRange||"")}</td><td><button class="text-link interface-ref-button" type="button">${ref}</button></td>`;
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
  $("editor-dhcp-dns").value=draft.dhcpDns; $("editor-dhcp-lease").value=draft.dhcpLease;
  $("editor-device-detection").checked=draft.deviceDetection; $("editor-enabled").checked=draft.enabled;
  $("interface-editor-errors").textContent=""; updateEditorVisibility(); showView("interface-editor");
}

function newInterfaceDraft(type){
  let realType=type==="Interface"?"VLAN":type, role="LAN";
  if(realType==="802.3ad Aggregate") role="LAN";
  return normalizeInterface({...baseInterface,id:uid(),group:groupForType(realType),name:realType==="VLAN"?"vlan10":realType==="Software Switch"?"switch1":realType==="802.3ad Aggregate"?"aggregate1":"loopback1",type:realType,role,ip:realType==="Loopback Interface"?"10.0.0.1":"192.168.10.1",mask:realType==="Loopback Interface"?"255.255.255.255":"255.255.255.0",parent:realType==="VLAN"?"lan":"",vlanId:realType==="VLAN"?10:null,access:["PING","HTTPS"]});
}

function closeInterfaceEditor(){editingInterfaceId=null;showView("interfaces");}
function populateParents(selected=""){$("editor-parent").innerHTML=state.interfaces.filter(i=>i.type!=="VLAN"&&i.type!=="Loopback Interface").map(i=>`<option ${i.name===selected?"selected":""}>${esc(i.name)}</option>`).join("");}
function currentAddressMode(){return document.querySelector('input[name="editor-address-mode"]:checked')?.value||"Manual";}
function setHidden(id,val){$(id).hidden=val;}

function updateEditorVisibility(){
  const type=$("editor-type").value, role=$("editor-role").value, mode=currentAddressMode(), vlan=type==="VLAN", wan=role==="WAN", dmz=role==="DMZ", manual=mode==="Manual";
  setHidden("field-parent-interface",!vlan); setHidden("field-vlan-id",!vlan); setHidden("field-estimated-bandwidth",!wan);
  setHidden("field-ip-netmask",!manual); setHidden("field-dhcp-client",mode!=="DHCP"); setHidden("field-pppoe",mode!=="PPPoE");
  setHidden("field-secondary-ip",!manual); setHidden("field-secondary-ip-values",!manual||!$("editor-secondary-enabled").checked);
  setHidden("field-create-address",wan||role==="Undefined"||!manual);
  setHidden("interface-dhcp-section",wan||dmz||!manual); setHidden("dhcp-settings-block",!$("editor-dhcp-enabled").checked);
  setHidden("interface-device-section",wan);
  $("interface-editor-warning").hidden=!(editingInterfaceId&&["lan","internal2"].includes(findInterface(editingInterfaceId)?.name));
}

function syncDhcpDefaults(){if(!$("editor-dhcp-enabled").checked)return; $("editor-dhcp-netmask").value=$("editor-mask").value; $("editor-dhcp-gateway").value=$("editor-ip").value;}

function saveInterfaceEditor(){
  const old=findInterface(editingInterfaceId), type=$("editor-type").value, role=$("editor-role").value, mode=currentAddressMode();
  const x=normalizeInterface({...(old||baseInterface),id:old?.id||uid(),name:$("editor-name").value.trim(),alias:$("editor-alias").value.trim(),type,group:groupForType(type),role,addressingMode:mode,parent:type==="VLAN"?$("editor-parent").value:"",vlanId:type==="VLAN"?Number($("editor-vlan-id").value):null,
    ip:mode==="Manual"?$("editor-ip").value.trim():"0.0.0.0",mask:mode==="Manual"?$("editor-mask").value.trim():"0.0.0.0",
    access:[...document.querySelectorAll("#control-ipv4-admin-access input:checked")].map(c=>c.value),
    bandwidthUp:Number($("editor-bandwidth-up").value||0),bandwidthDown:Number($("editor-bandwidth-down").value||0),dhcpDefaultRoute:$("editor-dhcp-default-route").checked,dhcpDistance:Number($("editor-dhcp-distance").value||5),pppoeUser:$("editor-pppoe-user").value,pppoePass:$("editor-pppoe-pass").value,
    createAddressObject:$("editor-create-address").checked,secondaryEnabled:$("editor-secondary-enabled").checked,secondaryIp:$("editor-secondary-ip").value.trim(),secondaryMask:$("editor-secondary-mask").value.trim(),
    dhcpEnabled:$("editor-dhcp-enabled").checked&&!["WAN","DMZ"].includes(role)&&mode==="Manual",dhcpStart:$("editor-dhcp-start").value.trim(),dhcpEnd:$("editor-dhcp-end").value.trim(),dhcpNetmask:$("editor-dhcp-netmask").value.trim(),dhcpGateway:$("editor-dhcp-gateway").value.trim(),dhcpDns:$("editor-dhcp-dns").value,dhcpLease:Number($("editor-dhcp-lease").value||86400),deviceDetection:$("editor-device-detection").checked,enabled:$("editor-enabled").checked,linkStatus:$("editor-enabled").checked?"Up":"Down"});
  x.dhcpRange=x.dhcpEnabled?`${x.dhcpStart}-${x.dhcpEnd}`:"";
  const errors=validateInterface(x,old); if(errors.length){$("interface-editor-errors").textContent=errors.join(" • ");return;}
  if(old){state.interfaces[state.interfaces.findIndex(i=>i.id===old.id)]=x;}else state.interfaces.push(x);
  syncConnectedRoute(x,old); saveState(); selectedInterfaceId=x.id; renderAll(); closeInterfaceEditor();
}

function validateInterface(x,old){
  const e=[]; if(!x.name)e.push("Interface name is required");
  if(!old&&state.interfaces.some(i=>i.name.toLowerCase()===x.name.toLowerCase())) e.push("Interface name already exists");
  if(x.type==="VLAN"&&(!Number.isInteger(x.vlanId)||x.vlanId<1||x.vlanId>4094)) e.push("VLAN ID must be 1-4094");
  if(x.type==="VLAN"&&state.interfaces.some(i=>i.id!==x.id&&i.type==="VLAN"&&i.parent===x.parent&&i.vlanId===x.vlanId)) e.push("This VLAN ID already exists on the parent interface");
  if(x.addressingMode==="Manual"){
    if(!isIPv4(x.ip)||!isValidNetmask(x.mask)) e.push("Enter a valid IPv4 address and contiguous netmask");
    if(isIPv4(x.ip)&&isValidNetmask(x.mask)&&x.mask!=="255.255.255.255"&&state.interfaces.some(i=>i.id!==x.id&&i.addressingMode==="Manual"&&isIPv4(i.ip)&&isValidNetmask(i.mask)&&subnetsOverlap(x.ip,x.mask,i.ip,i.mask))) e.push("IP subnet overlaps another interface");
  }
  if(x.secondaryEnabled&&(!isIPv4(x.secondaryIp)||!isValidNetmask(x.secondaryMask))) e.push("Secondary IP/Netmask is invalid");
  if(x.dhcpEnabled){
    if(!isIPv4(x.dhcpStart)||!isIPv4(x.dhcpEnd)) e.push("DHCP start/end must be valid IPv4 addresses");
    else if(ipToInt(x.dhcpStart)>ipToInt(x.dhcpEnd)) e.push("DHCP start must be before DHCP end");
    else if(!sameSubnet(x.ip,x.dhcpStart,x.mask)||!sameSubnet(x.ip,x.dhcpEnd,x.mask)) e.push("DHCP range must stay inside interface subnet");
    else if(ipToInt(x.ip)>=ipToInt(x.dhcpStart)&&ipToInt(x.ip)<=ipToInt(x.dhcpEnd)) e.push("DHCP range cannot include the interface IP");
  }
  return e;
}

function normalizeInterface(i){
  const x={...baseInterface,...i}; x.group=x.group||groupForType(x.type); x.dhcpRange=x.dhcpEnabled&&x.dhcpStart&&x.dhcpEnd?`${x.dhcpStart}-${x.dhcpEnd}`:(x.dhcpRange||""); return x;
}
function groupForType(t){return t==="VLAN"?"VLAN Interface":t==="Loopback Interface"?"Loopback Interface":t;}
function findInterface(id){return state.interfaces.find(i=>i.id===id);}
function syncConnectedRoute(x,old){
  state.routes=state.routes.filter(r=>!(r.connected&&r.interface===old?.name));
  if(x.enabled&&x.addressingMode==="Manual"&&isIPv4(x.ip)&&isValidNetmask(x.mask)&&x.role!=="WAN") state.routes.push({id:`connected-${x.id}`,destination:`${networkAddress(x.ip,x.mask)}/${maskToPrefix(x.mask)}`,gateway:"0.0.0.0",interface:x.name,distance:0,enabled:true,connected:true});
}
function getRefCount(i){return Math.max(Number(i.ref||0),state.routes.filter(r=>r.interface===i.name).length+state.policies.filter(p=>p.from===i.name||p.to===i.name).length+state.interfaces.filter(x=>x.parent===i.name).length);}
function showReferences(i){const refs=[];state.routes.filter(r=>r.interface===i.name).forEach(r=>refs.push(`Static Route: ${r.destination}`));state.policies.filter(p=>p.from===i.name||p.to===i.name).forEach(p=>refs.push(`Firewall Policy: ${p.name}`));state.interfaces.filter(x=>x.parent===i.name).forEach(x=>refs.push(`Child Interface: ${x.name}`));openModal(`References - ${i.name}`,`<p><strong>${getRefCount(i)} reference(s)</strong></p>${refs.length?`<ul>${refs.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>`:"<p>No active simulator references.</p>"}`,[{label:"Close",className:"btn-secondary",action:closeModal}]);}
function deleteSelectedInterface(){const i=findInterface(selectedInterfaceId);if(!i)return;if(getRefCount(i)>0){showReferences(i);return;}if(!confirm(`Delete interface "${i.name}"?`))return;state.interfaces=state.interfaces.filter(x=>x.id!==i.id);state.routes=state.routes.filter(r=>r.interface!==i.name);selectedInterfaceId=null;saveState();renderAll();}

function bindRoutes(){$("route-create-button").addEventListener("click",openRouteModal);$("route-delete-button").addEventListener("click",deleteRoute);}
function renderRoutes(){const b=$("routes-table-body");b.innerHTML="";state.routes.forEach(r=>{const tr=document.createElement("tr");if(r.id===selectedRouteId)tr.classList.add("selected");tr.innerHTML=`<td>${esc(r.destination)}</td><td>${esc(r.gateway)}</td><td>▣ ${esc(r.interface)}</td><td>${r.distance}</td><td class="${r.enabled?"status-enabled":"status-down"}">${r.enabled?"● Enabled":"● Disabled"}</td>`;tr.addEventListener("click",()=>{selectedRouteId=r.id;renderRoutes();updateButtons();});b.append(tr);});updateButtons();}
function openRouteModal(){openModal("Create Static Route",`<div class="form-grid"><div class="field"><label>Destination</label><input id="route-destination" value="0.0.0.0/0"></div><div class="field"><label>Gateway</label><input id="route-gateway" value="192.168.80.1"></div><div class="field"><label>Interface</label><select id="route-interface">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join("")}</select></div><div class="field"><label>Administrative Distance</label><input id="route-distance" type="number" min="0" value="10"></div></div>`,[{label:"Cancel",className:"btn-secondary",action:closeModal},{label:"Create",className:"btn-primary",action:saveRoute}]);}
function saveRoute(){const d=$("route-destination").value.trim(),g=$("route-gateway").value.trim();if(!isCIDR(d)||!isIPv4(g)){alert("Enter a valid destination CIDR and gateway.");return;}state.routes.push({id:uid(),destination:d,gateway:g,interface:$("route-interface").value,distance:Number($("route-distance").value||10),enabled:true});saveState();closeModal();renderRoutes();}
function deleteRoute(){const r=state.routes.find(x=>x.id===selectedRouteId);if(!r)return;if(r.connected){alert("Connected routes are managed by interface configuration.");return;}if(confirm(`Delete route ${r.destination}?`)){state.routes=state.routes.filter(x=>x.id!==r.id);selectedRouteId=null;saveState();renderRoutes();}}

function bindPolicies(){$("policy-create-button").addEventListener("click",openPolicyModal);$("policy-delete-button").addEventListener("click",deletePolicy);$("test-traffic-button").addEventListener("click",openTrafficModal);}
function renderPolicies(){const b=$("policies-table-body");b.innerHTML="";state.policies.forEach(p=>{const tr=document.createElement("tr");if(p.uid===selectedPolicyUid)tr.classList.add("selected");tr.innerHTML=`<td>${p.id}</td><td><strong>${esc(p.name)}</strong></td><td>▣ ${esc(p.from)}</td><td>▣ ${esc(p.to)}</td><td>${esc(p.source)}</td><td>${esc(p.destination)}</td><td>${esc(p.service)}</td><td class="${p.action==="ACCEPT"?"status-accept":"status-deny"}">${p.action==="ACCEPT"?"✓":"✕"} ${p.action}</td><td class="${p.nat?"status-accept":"status-deny"}">${p.nat?"● Yes":"✕ No"}</td>`;tr.addEventListener("click",()=>{selectedPolicyUid=p.uid;renderPolicies();updateButtons();});b.append(tr);});updateButtons();}
function openPolicyModal(){const opts=["all",...state.interfaces.map(i=>i.name)].map(x=>`<option>${esc(x)}</option>`).join("");openModal("Create Firewall Policy",`<div class="form-grid"><div class="field"><label>Name</label><input id="policy-name" value="New-Policy"></div><div class="field"><label>Action</label><select id="policy-action"><option>ACCEPT</option><option>DENY</option></select></div><div class="field"><label>Incoming Interface</label><select id="policy-from">${opts}</select></div><div class="field"><label>Outgoing Interface</label><select id="policy-to">${opts}</select></div><div class="field"><label>Source</label><input id="policy-source" value="all"></div><div class="field"><label>Destination</label><input id="policy-destination" value="all"></div><div class="field"><label>Service</label><select id="policy-service"><option>ALL</option><option>PING</option><option>HTTP</option><option>HTTPS</option><option>DNS</option><option>RDP</option></select></div><div class="field"><label>NAT</label><select id="policy-nat"><option value="true">ON</option><option value="false">OFF</option></select></div></div>`,[{label:"Cancel",className:"btn-secondary",action:closeModal},{label:"Create",className:"btn-primary",action:savePolicy}]);}
function savePolicy(){const id=Math.max(0,...state.policies.map(p=>p.id))+1;const p={id,uid:uid(),name:$("policy-name").value.trim()||`Policy-${id}`,from:$("policy-from").value,to:$("policy-to").value,source:$("policy-source").value.trim()||"all",destination:$("policy-destination").value.trim()||"all",service:$("policy-service").value,action:$("policy-action").value,nat:$("policy-nat").value==="true",enabled:true};const denyIndex=state.policies.findIndex(x=>x.name==="Deny-ALL");state.policies.splice(denyIndex<0?state.policies.length:denyIndex,0,p);saveState();closeModal();renderAll();}
function deletePolicy(){const p=state.policies.find(x=>x.uid===selectedPolicyUid);if(p&&confirm(`Delete policy "${p.name}"?`)){state.policies=state.policies.filter(x=>x.uid!==p.uid);selectedPolicyUid=null;saveState();renderAll();}}

function bindLogs(){$("generate-log-button").addEventListener("click",openTrafficModal);$("clear-logs-button").addEventListener("click",()=>{state.logs=[];saveState();renderAll();});}
function renderLogs(){const b=$("logs-table-body");b.innerHTML="";[...state.logs].reverse().forEach(l=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(l.time)}</td><td class="${l.action==="ACCEPT"?"status-accept":"status-deny"}">${l.action==="ACCEPT"?"✓":"✕"} ${l.action}</td><td>${esc(String(l.policy))}</td><td>${esc(l.source)}</td><td>${esc(l.destination)}</td><td>${esc(l.service)}</td><td>${esc(l.reason)}</td>`;b.append(tr);});}
function openTrafficModal(){openModal("Test Traffic",`<div class="form-grid"><div class="field"><label>Source IP</label><input id="test-source" value="192.168.1.50"></div><div class="field"><label>Destination IP</label><input id="test-destination" value="8.8.8.8"></div><div class="field"><label>Incoming Interface</label><select id="test-incoming">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join("")}</select></div><div class="field"><label>Outgoing Interface</label><select id="test-outgoing">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join("")}</select></div><div class="field"><label>Service</label><select id="test-service"><option>PING</option><option>HTTP</option><option>HTTPS</option><option>DNS</option><option>RDP</option></select></div><div class="field"><label>Simulator Logic</label><div class="muted">Route → Policy → NAT → Result → Log</div></div></div>`,[{label:"Cancel",className:"btn-secondary",action:closeModal},{label:"Run Test",className:"btn-primary",action:runTraffic}]);if(findByName("lan"))$("test-incoming").value="lan";if(findByName("wan"))$("test-outgoing").value="wan";}
function runTraffic(){const source=$("test-source").value.trim(),destination=$("test-destination").value.trim(),incoming=$("test-incoming").value,outgoing=$("test-outgoing").value,service=$("test-service").value;if(!isIPv4(source)||!isIPv4(destination)){alert("Enter valid source and destination IPv4 addresses.");return;}const r=evaluateTraffic({source,destination,incoming,outgoing,service});state.logs.push({id:uid(),time:new Date().toLocaleTimeString(),action:r.action,policy:r.policyId,source,destination,service,reason:r.reason});state.logs=state.logs.slice(-200);saveState();closeModal();renderAll();alert(`${r.action}\n${r.reason}`);}
function evaluateTraffic({destination,incoming,outgoing,service}){const route=findBestRoute(destination,outgoing);if(!route)return{action:"DENY",policyId:"-",reason:"No route to destination"};const p=state.policies.find(p=>p.enabled&&(p.from===incoming||p.from==="all")&&(p.to===outgoing||p.to==="all")&&(p.service===service||p.service==="ALL"));if(!p)return{action:"DENY",policyId:"-",reason:"Implicit deny: no matching firewall policy"};if(p.action==="DENY")return{action:"DENY",policyId:p.id,reason:`Denied by policy ${p.name}`};if(outgoing==="wan"&&!p.nat)return{action:"DENY",policyId:p.id,reason:"Policy matched but source NAT is disabled for Internet traffic"};return{action:"ACCEPT",policyId:p.id,reason:`Policy ${p.name} matched; route found${outgoing==="wan"&&p.nat?"; source NAT applied":""}`};}
function findBestRoute(ip,outgoing){return state.routes.filter(r=>r.enabled&&r.interface===outgoing&&cidrContains(r.destination,ip)).sort((a,b)=>Number(b.destination.split("/")[1])-Number(a.destination.split("/")[1])||a.distance-b.distance)[0]||null;}

function renderDashboard(){const mini=(h,rows)=>`<table class="data-table"><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${esc(String(x))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;$("interfaces-summary-body").innerHTML=mini(["Name","IP/Netmask","Access"],state.interfaces.slice(0,5).map(i=>[i.name,`${i.ip}/${i.mask}`,(i.access||[]).slice(0,3).join(" ")]));$("policy-summary-body").innerHTML=mini(["ID","Name","From","To","Action","NAT"],state.policies.slice(0,5).map(p=>[p.id,p.name,p.from,p.to,p.action,p.nat?"Yes":"No"]));$("log-summary-body").innerHTML=mini(["Time","Action","Source","Destination"],[...state.logs].slice(-6).reverse().map(l=>[l.time,l.action,l.source,l.destination]));$("topology-wan-ip").textContent=findByName("wan")?.ip||"—";$("topology-lan-ip").textContent=findByName("lan")?.ip||"—";$("topology-dmz-ip").textContent=findByName("dmz")?.ip||"—";}
function renderAll(){renderInterfaces();renderRoutes();renderPolicies();renderLogs();renderDashboard();}
function updateButtons(){$("interface-edit-button").disabled=!selectedInterfaceId;$("interface-delete-button").disabled=!selectedInterfaceId;$("interface-integrate-button").disabled=true;$("route-delete-button").disabled=!selectedRouteId;$("policy-delete-button").disabled=!selectedPolicyUid;}
function findByName(name){return state.interfaces.find(i=>i.name===name);}

function bindModal(){$("modal-close-button").addEventListener("click",closeModal);$("modal-backdrop").addEventListener("click",e=>{if(e.target===$("modal-backdrop"))closeModal();});document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();$("cli-panel").hidden=true;}});}
function openModal(title,html,actions){$("modal-title").textContent=title;$("modal-body").innerHTML=html;$("modal-actions").innerHTML="";actions.forEach(a=>{const b=document.createElement("button");b.className=a.className;b.textContent=a.label;b.addEventListener("click",a.action);$("modal-actions").append(b);});$("modal-backdrop").hidden=false;}
function closeModal(){$("modal-backdrop").hidden=true;$("modal-body").innerHTML="";$("modal-actions").innerHTML="";}

function bindCli(){$("cli-open-button").addEventListener("click",()=>{$("cli-panel").hidden=false;$("cli-input").focus();});$("cli-close-button").addEventListener("click",()=>$("cli-panel").hidden=true);$("cli-input").addEventListener("keydown",e=>{if(e.key==="Enter"){const c=$("cli-input").value.trim();$("cli-input").value="";runCli(c);}});}
function cli(t){$("cli-output").textContent+=`\n${t}`;$("cli-output").scrollTop=$("cli-output").scrollHeight;}
function runCli(c){if(!c)return;cli(`FG-SIM-01 # ${c}`);const n=c.toLowerCase();if(n==="get router info routing-table all"){cli("Routing table (simulated)");state.routes.forEach(r=>cli(`${r.connected?"C":"S"} ${r.destination} via ${r.gateway}, ${r.interface}, distance ${r.distance}`));}else if(n==="get system interface physical"){cli("Physical interface status (simulated)");state.interfaces.filter(i=>i.type==="Physical Interface").forEach(i=>cli(`${i.name}: ${i.enabled?"up":"down"} ${i.ip}/${i.mask}`));}else if(n.startsWith("execute ping ")){const ip=c.split(/\s+/).pop(),r=isIPv4(ip)?evaluateTraffic({destination:ip,incoming:"lan",outgoing:"wan",service:"PING"}):{action:"DENY",reason:"Invalid IP address"};cli(r.action==="ACCEPT"?`PING ${ip}: 56 data bytes\n64 bytes from ${ip}: icmp_seq=0 ttl=117 time=12.4 ms\n1 packets transmitted, 1 packets received, 0% packet loss`:`PING ${ip}: timeout\nReason: ${r.reason}`);}else if(n.startsWith("diagnose sniffer packet")){cli("interfaces=[any]\nfilters=[simulated]\n0.000000 lan in 192.168.1.50 -> 8.8.8.8: icmp echo request\n0.012400 wan out 192.168.80.49 -> 8.8.8.8: icmp echo request");}else if(n==="clear"){$("cli-output").textContent="";}else if(n==="help"||n==="?"){cli("get router info routing-table all\nget system interface physical\nexecute ping <ip>\ndiagnose sniffer packet any 'host <ip>' 4 0 l\nclear");}else cli('Command fail. Return code -61\nType "help" for supported simulator commands.');cli("");}

function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return structuredClone(defaultState);const p=JSON.parse(raw);if(!p||![p.interfaces,p.routes,p.policies,p.logs].every(Array.isArray))return structuredClone(defaultState);p.interfaces=p.interfaces.map(normalizeInterface);if(!p.interfaces.some(i=>i.name==="fortilink"))p.interfaces.unshift(structuredClone(defaultState.interfaces[0]));if(!p.routes.some(r=>r.interface==="fortilink"))p.routes.push(structuredClone(defaultState.routes[1]));return p;}catch{return structuredClone(defaultState);}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function isIPv4(v){const a=String(v).split(".");return a.length===4&&a.every(x=>/^\d+$/.test(x)&&+x>=0&&+x<=255);}
function ipToInt(ip){return ip.split(".").reduce((n,x)=>((n<<8)+Number(x))>>>0,0)>>>0;}
function isValidNetmask(m){if(!isIPv4(m))return false;const inv=(~ipToInt(m))>>>0;return ((inv+1)&inv)===0;}
function maskToPrefix(m){return isValidNetmask(m)?m.split(".").reduce((n,x)=>n+(Number(x).toString(2).match(/1/g)||[]).length,0):0;}
function networkAddress(ip,m){const n=(ipToInt(ip)&ipToInt(m))>>>0;return [24,16,8,0].map(s=>(n>>>s)&255).join(".");}
function sameSubnet(a,b,m){return networkAddress(a,m)===networkAddress(b,m);}
function subnetsOverlap(a,ma,b,mb){const p=Math.min(maskToPrefix(ma),maskToPrefix(mb)),m=p===0?0:(0xffffffff<<(32-p))>>>0;return (ipToInt(a)&m)===(ipToInt(b)&m);}
function isCIDR(v){const [ip,p]=v.split("/");return isIPv4(ip)&&/^\d+$/.test(p||"")&&+p>=0&&+p<=32;}
function cidrContains(cidr,ip){if(!isCIDR(cidr)||!isIPv4(ip))return false;const [net,p]=cidr.split("/"),mask=+p===0?0:(0xffffffff<<(32-+p))>>>0;return (ipToInt(net)&mask)===(ipToInt(ip)&mask);}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
