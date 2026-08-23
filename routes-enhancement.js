/* FortiOS 7.0-style Static Routes enhancement. */
let rtEditingId = null;
let rtLookupMatchId = null;
let rtSearchText = '';

function rtInitState(){
  state.routes.forEach(route => {
    route.priority = Number.isFinite(Number(route.priority)) ? Number(route.priority) : 0;
    route.destinationType ||= 'Subnet';
    route.destinationObject ||= '';
    route.dynamicGateway = Boolean(route.dynamicGateway);
    route.blackhole = Boolean(route.blackhole || route.interface === 'Blackhole');
    route.comment ||= '';
    route.vrf = Number.isFinite(Number(route.vrf)) ? Number(route.vrf) : 0;
  });
  saveState();
}

function rtPrepareViews(){
  const view = $('view-static-routes');
  if(!view) return;
  view.innerHTML = `
    <div id="routes-header" class="page-heading-row"><h1 id="routes-title">Static Routes</h1></div>
    <div id="routes-toolbar" class="toolbar">
      <button id="route-create-button" class="btn-primary">＋ Create New</button>
      <button id="route-edit-button" class="btn-secondary" disabled>✎ Edit</button>
      <button id="route-delete-button" class="btn-secondary" disabled>▱ Delete</button>
      <button id="route-lookup-button" class="btn-secondary">⌕ Route Lookup</button>
      <button id="route-monitor-button" class="btn-secondary">▦ Routing Monitor</button>
      <div id="toolbar-grow"></div>
      <input id="route-search" class="search-input" type="search" placeholder="Search routes" aria-label="Search routes" />
    </div>
    <div id="routes-table-wrap" class="table-wrap full-table-wrap">
      <table id="routes-table" class="data-table">
        <thead><tr>
          <th id="route-status-heading">Status</th>
          <th id="route-destination-heading">Destination</th>
          <th id="route-gateway-heading">Gateway</th>
          <th id="route-interface-heading">Interface</th>
          <th id="route-distance-heading">Distance</th>
          <th id="route-priority-heading">Priority</th>
          <th id="route-type-heading">Type</th>
        </tr></thead>
        <tbody id="routes-table-body"></tbody>
      </table>
    </div>
    <div id="routes-help-line" class="muted">Lower distance wins. If distance is equal, lower priority wins. Longest prefix match is checked first.</div>`;

  if(!$('view-route-editor')){
    const editor = document.createElement('section');
    editor.id = 'view-route-editor';
    editor.className = 'app-view';
    editor.innerHTML = `
      <div id="route-editor-header" class="page-heading-row"><h1 id="route-editor-title">New Static Route</h1></div>
      <form id="route-editor-form" novalidate>
        <div id="route-editor-toolbar" class="toolbar">
          <button id="route-editor-ok-top" type="submit" class="btn-primary">OK</button>
          <button id="route-editor-cancel-top" type="button" class="btn-secondary">Cancel</button>
        </div>

        <section id="route-basic-section" class="forti-form-section">
          <h2 id="route-basic-title">Static Route</h2>
          <div id="route-basic-fields" class="forti-form-body">
            <div id="field-route-status" class="forti-field-row">
              <label id="label-route-status">Status</label>
              <div id="control-route-status"><label id="route-status-switch" class="forti-switch"><input id="route-status" type="checkbox" checked><span></span></label></div>
            </div>
            <div id="field-route-destination-type" class="forti-field-row">
              <label id="label-route-destination-type">Destination</label>
              <div id="control-route-destination-type" class="forti-radio-row">
                <label id="route-dest-subnet-label"><input id="route-dest-subnet" type="radio" name="route-destination-type" value="Subnet" checked> Subnet</label>
                <label id="route-dest-address-label"><input id="route-dest-address" type="radio" name="route-destination-type" value="Named Address"> Named Address</label>
              </div>
            </div>
            <div id="field-route-subnet" class="forti-field-row">
              <label id="label-route-subnet">Destination Subnet</label>
              <div id="control-route-subnet" class="inline-controls">
                <input id="route-destination-ip" type="text" value="0.0.0.0" inputmode="decimal">
                <span>/</span>
                <input id="route-destination-mask" type="text" value="0.0.0.0" inputmode="decimal">
              </div>
            </div>
            <div id="field-route-address-object" class="forti-field-row" hidden>
              <label id="label-route-address-object" for="route-address-object">Named Address</label>
              <div id="control-route-address-object"><select id="route-address-object"></select></div>
            </div>
            <div id="field-route-interface" class="forti-field-row">
              <label id="label-route-interface" for="route-interface">Interface</label>
              <div id="control-route-interface"><select id="route-interface"></select></div>
            </div>
            <div id="field-route-dynamic-gateway" class="forti-field-row" hidden>
              <label id="label-route-dynamic-gateway">Dynamic Gateway</label>
              <div id="control-route-dynamic-gateway"><label id="route-dynamic-gateway-switch" class="forti-switch"><input id="route-dynamic-gateway" type="checkbox"><span></span></label></div>
            </div>
            <div id="field-route-gateway" class="forti-field-row">
              <label id="label-route-gateway" for="route-gateway">Gateway Address</label>
              <div id="control-route-gateway"><input id="route-gateway" type="text" value="192.168.80.1" inputmode="decimal"></div>
            </div>
            <div id="field-route-distance" class="forti-field-row">
              <label id="label-route-distance" for="route-distance">Administrative Distance</label>
              <div id="control-route-distance"><input id="route-distance" type="number" min="1" max="255" value="10"></div>
            </div>
          </div>
        </section>

        <section id="route-advanced-section" class="forti-form-section">
          <h2 id="route-advanced-title">Advanced Options</h2>
          <div id="route-advanced-fields" class="forti-form-body">
            <div id="field-route-priority" class="forti-field-row">
              <label id="label-route-priority" for="route-priority">Priority</label>
              <div id="control-route-priority"><input id="route-priority" type="number" min="0" max="4294967295" value="0"></div>
            </div>
            <div id="field-route-vrf" class="forti-field-row">
              <label id="label-route-vrf" for="route-vrf">VRF</label>
              <div id="control-route-vrf"><input id="route-vrf" type="number" min="0" value="0"></div>
            </div>
            <div id="field-route-comment" class="forti-field-row">
              <label id="label-route-comment" for="route-comment">Comments</label>
              <div id="control-route-comment"><input id="route-comment" type="text" maxlength="255" placeholder="Optional"></div>
            </div>
          </div>
        </section>

        <div id="route-editor-errors" class="muted"></div>
        <div id="route-editor-actions" class="toolbar">
          <button id="route-editor-ok-bottom" type="submit" class="btn-primary">OK</button>
          <button id="route-editor-cancel-bottom" type="button" class="btn-secondary">Cancel</button>
        </div>
      </form>`;
    $('main-content').append(editor);
  }
}

function bindRoutes(){
  $('route-create-button')?.addEventListener('click',()=>rtOpenEditor());
  $('route-edit-button')?.addEventListener('click',()=>{const r=state.routes.find(x=>x.id===selectedRouteId);if(r)rtOpenEditor(r);});
  $('route-delete-button')?.addEventListener('click',deleteRoute);
  $('route-lookup-button')?.addEventListener('click',rtOpenLookup);
  $('route-monitor-button')?.addEventListener('click',rtOpenMonitor);
  $('route-search')?.addEventListener('input',e=>{rtSearchText=e.target.value.trim().toLowerCase();renderRoutes();});
  $('route-editor-form')?.addEventListener('submit',e=>{e.preventDefault();rtSaveEditor();});
  $('route-editor-cancel-top')?.addEventListener('click',rtCloseEditor);
  $('route-editor-cancel-bottom')?.addEventListener('click',rtCloseEditor);
  document.querySelectorAll('input[name="route-destination-type"]').forEach(el=>el.addEventListener('change',rtSyncEditor));
  $('route-interface')?.addEventListener('change',rtSyncEditor);
  $('route-dynamic-gateway')?.addEventListener('change',rtSyncEditor);
}

function renderRoutes(){
  const body=$('routes-table-body');if(!body)return;
  body.innerHTML='';
  const routes=state.routes.filter(r=>!r.connected&&!r.dynamic).filter(r=>{
    if(!rtSearchText)return true;
    return [r.destination,r.gateway,r.interface,r.comment,r.type].join(' ').toLowerCase().includes(rtSearchText);
  }).sort(routeSort);
  routes.forEach(route=>{
    const tr=document.createElement('tr');
    if(route.id===selectedRouteId||route.id===rtLookupMatchId)tr.classList.add('selected');
    const isBlackhole=route.blackhole||route.interface==='Blackhole';
    tr.innerHTML=`<td class="${route.enabled!==false?'status-enabled':'status-down'}">${route.enabled!==false?'● Enabled':'● Disabled'}</td><td><strong>${esc(route.destination)}</strong>${route.destinationType==='Named Address'&&route.destinationObject?` <span class="muted">(${esc(route.destinationObject)})</span>`:''}</td><td>${isBlackhole?'—':esc(route.gateway||'—')}</td><td>${isBlackhole?'⊘ Blackhole':`▣ ${esc(route.interface)}`}</td><td>${Number(route.distance)||10}</td><td>${Number(route.priority)||0}</td><td>${isBlackhole?'Blackhole':'Static'}</td>`;
    tr.addEventListener('click',()=>{selectedRouteId=route.id;renderRoutes();rtUpdateButtons();});
    tr.addEventListener('dblclick',()=>rtOpenEditor(route));
    body.append(tr);
  });
  rtUpdateButtons();
}

function rtUpdateButtons(){
  const route=state.routes.find(r=>r.id===selectedRouteId);
  if($('route-edit-button'))$('route-edit-button').disabled=!route||route.connected||route.dynamic;
  if($('route-delete-button'))$('route-delete-button').disabled=!route||route.connected||route.dynamic;
}

function rtOpenEditor(route=null){
  rtEditingId=route?.id||null;
  $('route-editor-title').textContent=route?'Edit Static Route':'New Static Route';
  $('route-status').checked=route?.enabled!==false;
  const destType=route?.destinationType||'Subnet';
  const radio=document.querySelector(`input[name="route-destination-type"][value="${destType}"]`);if(radio)radio.checked=true;
  const [destIp,prefixText]=(route?.destination||'0.0.0.0/0').split('/');
  $('route-destination-ip').value=destIp||'0.0.0.0';
  $('route-destination-mask').value=rtPrefixToMask(Number(prefixText||0));
  rtFillAddressObjects(route?.destinationObject||'');
  rtFillInterfaces(route?.interface||'wan');
  $('route-gateway').value=route?.gateway||rtSuggestedGateway(route?.interface||'wan');
  $('route-distance').value=Number(route?.distance??10);
  $('route-priority').value=Number(route?.priority??0);
  $('route-vrf').value=Number(route?.vrf??0);
  $('route-comment').value=route?.comment||'';
  $('route-dynamic-gateway').checked=Boolean(route?.dynamicGateway);
  $('route-editor-errors').textContent='';
  rtSyncEditor();
  showView('route-editor');
}

function rtCloseEditor(){rtEditingId=null;showView('static-routes');renderRoutes();}

function rtFillInterfaces(selected='wan'){
  const select=$('route-interface');if(!select)return;
  const names=state.interfaces.filter(i=>i.enabled!==false).map(i=>i.name);
  select.innerHTML=[...names,'Blackhole'].map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  select.value=names.includes(selected)||selected==='Blackhole'?selected:(names.includes('wan')?'wan':names[0]||'Blackhole');
}

function rtFillAddressObjects(selected=''){
  const select=$('route-address-object');if(!select)return;
  const addresses=(state.addresses||[]).filter(a=>a.type==='Subnet'&&isCIDR(a.value));
  select.innerHTML=addresses.map(a=>`<option value="${esc(a.name)}">${esc(a.name)} — ${esc(a.value)}</option>`).join('');
  if(selected&&addresses.some(a=>a.name===selected))select.value=selected;
}

function rtSyncEditor(){
  const type=document.querySelector('input[name="route-destination-type"]:checked')?.value||'Subnet';
  $('field-route-subnet').hidden=type!=='Subnet';
  $('field-route-address-object').hidden=type!=='Named Address';
  const iface=$('route-interface')?.value||'';
  const intf=findByName(iface);
  const dynamicCapable=Boolean(intf&&['DHCP','PPPoE'].includes(intf.addressingMode));
  $('field-route-dynamic-gateway').hidden=!dynamicCapable;
  if(!dynamicCapable)$('route-dynamic-gateway').checked=false;
  const noGateway=iface==='Blackhole'||$('route-dynamic-gateway').checked;
  $('route-gateway').disabled=noGateway;
  if(iface==='Blackhole')$('route-gateway').value='0.0.0.0';
  else if(!$('route-gateway').value||$('route-gateway').value==='0.0.0.0')$('route-gateway').value=rtSuggestedGateway(iface);
}

function rtSaveEditor(){
  const errors=[];
  const type=document.querySelector('input[name="route-destination-type"]:checked')?.value||'Subnet';
  let destination='',destinationObject='';
  if(type==='Subnet'){
    const ip=$('route-destination-ip').value.trim(),mask=$('route-destination-mask').value.trim();
    const prefix=rtMaskToPrefix(mask);
    if(!isIPv4(ip)||prefix<0)errors.push('Enter a valid destination IP and contiguous netmask.');
    else destination=`${rtNetworkAddress(ip,prefix)}/${prefix}`;
  }else{
    destinationObject=$('route-address-object').value;
    const obj=(state.addresses||[]).find(a=>a.name===destinationObject&&a.type==='Subnet'&&isCIDR(a.value));
    if(!obj)errors.push('Select a valid subnet address object.');
    else destination=obj.value;
  }

  const iface=$('route-interface').value;
  const blackhole=iface==='Blackhole';
  const dynamicGateway=!blackhole&&$('route-dynamic-gateway').checked;
  const intf=blackhole?null:findByName(iface);
  if(!blackhole&&!intf)errors.push('Select a valid interface.');
  if(dynamicGateway&&!['DHCP','PPPoE'].includes(intf?.addressingMode))errors.push('Dynamic Gateway requires a DHCP or PPPoE interface.');

  let gateway=blackhole||dynamicGateway?'0.0.0.0':$('route-gateway').value.trim();
  if(!blackhole&&!dynamicGateway&&!isIPv4(gateway))errors.push('Enter a valid gateway address.');
  if(!blackhole&&!dynamicGateway&&intf&&isIPv4(intf.ip)&&intf.ip!=='0.0.0.0'&&isIPv4(intf.mask)&&!rtSameSubnet(gateway,intf.ip,intf.mask))errors.push(`Gateway ${gateway} is not reachable through interface ${iface}.`);

  const distance=Number($('route-distance').value),priority=Number($('route-priority').value),vrf=Number($('route-vrf').value);
  if(!Number.isInteger(distance)||distance<1||distance>255)errors.push('Administrative Distance must be 1-255.');
  if(!Number.isInteger(priority)||priority<0||priority>4294967295)errors.push('Priority must be 0-4294967295.');
  if(!Number.isInteger(vrf)||vrf<0)errors.push('VRF must be 0 or higher.');

  const duplicate=state.routes.find(r=>r.id!==rtEditingId&&!r.connected&&!r.dynamic&&r.destination===destination&&r.interface===iface&&String(r.gateway||'0.0.0.0')===String(gateway)&&Number(r.distance)===distance&&Number(r.priority||0)===priority);
  if(duplicate)errors.push('An identical static route already exists.');

  if(errors.length){$('route-editor-errors').textContent=errors.join(' ');return;}
  const payload={
    id:rtEditingId||uid(),destination,destinationType:type,destinationObject,gateway,interface:iface,
    distance,priority,vrf,enabled:$('route-status').checked,type:'static',dynamicGateway,blackhole,
    comment:$('route-comment').value.trim()
  };
  const idx=state.routes.findIndex(r=>r.id===rtEditingId);
  if(idx>=0)state.routes[idx]=payload;else state.routes.push(payload);
  selectedRouteId=payload.id;rtEditingId=null;saveState();showView('static-routes');renderRoutes();
}

function deleteRoute(){
  const route=state.routes.find(r=>r.id===selectedRouteId);if(!route)return;
  if(route.connected||route.dynamic){alert('Connected and dynamic routes are managed automatically.');return;}
  if(confirm(`Delete route ${route.destination}?`)){
    state.routes=state.routes.filter(r=>r.id!==route.id);selectedRouteId=null;rtLookupMatchId=null;saveState();renderRoutes();
  }
}

function rtOpenLookup(){
  openModal('Route Lookup',`<div class="form-grid"><div class="field full"><label for="route-lookup-destination">Destination</label><input id="route-lookup-destination" type="text" value="8.8.8.8" placeholder="8.8.8.8"></div><div class="field full"><div id="route-lookup-result" class="muted">Enter a destination IP to find the best active route.</div></div></div>`,[
    {label:'Close',className:'btn-secondary',action:closeModal},
    {label:'Search',className:'btn-primary',action:rtRunLookup}
  ]);
}

function rtRunLookup(){
  const ip=$('route-lookup-destination').value.trim();
  if(!isIPv4(ip)){$('route-lookup-result').textContent='Enter a valid IPv4 address.';return;}
  const route=findBestRoute(ip);
  if(!route){rtLookupMatchId=null;$('route-lookup-result').textContent='No active route found.';return;}
  rtLookupMatchId=route.id;
  const blackhole=route.blackhole||route.interface==='Blackhole';
  $('route-lookup-result').textContent=blackhole?`Matched ${route.destination}. Traffic is dropped by Blackhole route.`:`Matched ${route.destination} via ${route.gateway||'directly connected'} on ${route.interface}. Distance ${route.distance}, priority ${route.priority||0}.`;
  renderRoutes();
}

function rtOpenMonitor(){
  const rows=state.routes.filter(r=>r.enabled!==false).sort(routeSort).map(r=>{
    const code=r.connected?'C':r.dynamic?'S*':'S';
    const blackhole=r.blackhole||r.interface==='Blackhole';
    return `<tr><td>${code}</td><td>${esc(r.destination)}</td><td>${blackhole?'—':esc(r.gateway||'—')}</td><td>${blackhole?'Blackhole':esc(r.interface)}</td><td>${Number(r.distance)||0}</td><td>${Number(r.priority)||0}</td></tr>`;
  }).join('');
  openModal('Static & Dynamic Routing Monitor',`<div class="table-wrap full-table-wrap"><table class="data-table"><thead><tr><th>Code</th><th>Network</th><th>Gateway</th><th>Interface</th><th>Distance</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table></div>`,[{label:'Close',className:'btn-secondary',action:closeModal}]);
}

function routeSort(a,b){
  const pa=Number(String(a.destination).split('/')[1]||0),pb=Number(String(b.destination).split('/')[1]||0);
  return pb-pa || Number(a.distance||0)-Number(b.distance||0) || Number(a.priority||0)-Number(b.priority||0) || String(a.interface).localeCompare(String(b.interface));
}

function isRouteUsable(route){
  if(!route||route.enabled===false)return false;
  if(route.blackhole||route.interface==='Blackhole')return true;
  const intf=findByName(route.interface);return Boolean(intf&&isInterfaceOperational(intf));
}

function findBestRoute(ip){
  return state.routes.filter(r=>r.enabled!==false&&cidrContains(r.destination,ip)&&isRouteUsable(r)).sort(routeSort)[0]||null;
}

function evaluateTraffic({source,destination,incoming,outgoing,service}){
  const inIf=findByName(incoming);
  if(!inIf||!isInterfaceOperational(inIf))return{action:'DENY',policyId:'-',reason:`Incoming interface ${incoming} is down`};
  if(inIf.addressingMode==='One-Arm Sniffer')return{action:'DENY',policyId:'-',reason:`Interface ${incoming} is in One-Arm Sniffer mode`};

  const reverse=findBestRoute(source);
  if(!reverse||reverse.interface!==incoming)return{action:'DENY',policyId:'-',reason:`Reverse path check failed for source ${source} on ${incoming}`};

  const vip=typeof poVip==='function'?poVip(destination,incoming):null;
  const dst=vip?.mappedIp||destination;
  const route=findBestRoute(dst);
  if(!route)return{action:'DENY',policyId:'-',reason:'No route to destination'};
  if(route.blackhole||route.interface==='Blackhole')return{action:'DENY',policyId:'-',reason:`Blackhole route ${route.destination} matched destination ${dst}`};
  if(outgoing&&outgoing!==route.interface)return{action:'DENY',policyId:'-',reason:`Route lookup selects ${route.interface}, not ${outgoing}`};

  const policy=state.policies.find(p=>p.enabled!==false&&(p.from===incoming||p.from==='all')&&(p.to===route.interface||p.to==='all')&&(typeof poAddr!=='function'||poAddr(p.source,source))&&((vip&&p.destination===vip.name)||(typeof poAddr!=='function'||poAddr(p.destination,dst)))&&(p.service==='ALL'||p.service===service)&&(typeof poSchedule!=='function'||poSchedule(p.schedule)));
  if(!policy)return{action:'DENY',policyId:'-',reason:'Implicit deny: no matching firewall policy'};
  if(policy.action==='DENY')return{action:'DENY',policyId:policy.id,reason:`Denied by policy ${policy.name}`};
  if(route.interface==='wan'&&typeof poPrivate==='function'&&poPrivate(source)&&!poPrivate(dst)&&!policy.nat)return{action:'DENY',policyId:policy.id,reason:`Policy ${policy.name} matched but source NAT is disabled for Internet traffic`};
  if(policy.nat&&policy.natMode==='Use Dynamic IP Pool'&&!(state.ipPools||[]).some(x=>x.name===policy.ipPool))return{action:'DENY',policyId:policy.id,reason:`Policy ${policy.name} references a missing IP Pool`};
  const why=[`Policy ${policy.name} matched`,`route ${route.destination} via ${route.interface}`];
  if(vip)why.push(`VIP ${vip.name}: ${destination} → ${dst}`);
  if(policy.nat)why.push(policy.natMode==='Use Dynamic IP Pool'?`SNAT pool ${policy.ipPool}`:'source NAT applied');
  return{action:'ACCEPT',policyId:policy.id,reason:why.join('; '),outgoing:route.interface};
}

function rtMaskToPrefix(mask){
  if(!isIPv4(mask))return -1;
  const bits=mask.split('.').map(Number).map(n=>n.toString(2).padStart(8,'0')).join('');
  if(!/^1*0*$/.test(bits))return -1;
  return bits.indexOf('0')===-1?32:bits.indexOf('0');
}
function rtPrefixToMask(prefix){
  prefix=Math.max(0,Math.min(32,Number(prefix)||0));
  const bits='1'.repeat(prefix).padEnd(32,'0');
  return [0,8,16,24].map(i=>parseInt(bits.slice(i,i+8),2)).join('.');
}
function rtNetworkAddress(ip,prefix){
  const mask=prefix===0?0:(0xffffffff << (32-prefix))>>>0;
  const n=ipToInt(ip)&mask;
  return [24,16,8,0].map(s=>(n>>>s)&255).join('.');
}
function rtSameSubnet(a,b,mask){
  const p=rtMaskToPrefix(mask);if(p<0)return false;
  return rtNetworkAddress(a,p)===rtNetworkAddress(b,p);
}
function rtSuggestedGateway(interfaceName){
  const intf=findByName(interfaceName);if(!intf)return '0.0.0.0';
  if(intf.acquiredGateway)return intf.acquiredGateway;
  if(!isIPv4(intf.ip)||!isIPv4(intf.mask)||intf.ip==='0.0.0.0')return '0.0.0.0';
  const p=rtMaskToPrefix(intf.mask);if(p<0)return '0.0.0.0';
  const net=ipToInt(rtNetworkAddress(intf.ip,p));
  const candidate=(net+1)>>>0;
  return [24,16,8,0].map(s=>(candidate>>>s)&255).join('.');
}

const rtCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim();
  const match=text.match(/^get router info routing-table details\s+(\d+\.\d+\.\d+\.\d+)$/i);
  if(match){
    cli(`FG-SIM-01 # ${text}`);
    const ip=match[1];
    if(!isIPv4(ip)){cli('Invalid destination.');return;}
    const route=findBestRoute(ip);
    if(!route){cli(`Routing table for VRF=0\nNo route to ${ip}`);return;}
    const blackhole=route.blackhole||route.interface==='Blackhole';
    cli(`Routing table for VRF=${route.vrf||0}\nRouting entry for ${route.destination}\n  Known via "${route.connected?'connected':route.dynamic?'dynamic':'static'}", distance ${route.distance}, priority ${route.priority||0}, best\n  * ${blackhole?'blackhole':`${route.gateway||'0.0.0.0'}, via ${route.interface}`}`);
    return;
  }
  rtCoreRunCli(text);
};

rtInitState();
rtPrepareViews();
