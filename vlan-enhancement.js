/* FortiOS 7.0-style VLAN and inter-VLAN enhancement. */
let vlanLastIngress = null;

function vlanNetworkCidr(intf){
  if(!intf || !isIPv4(intf.ip) || !isValidNetmask(intf.mask) || intf.ip === '0.0.0.0') return '';
  return `${networkAddress(intf.ip,intf.mask)}/${maskToPrefix(intf.mask)}`;
}

function vlanParent(intf){
  return intf?.type === 'VLAN' ? findByName(intf.parent) : null;
}

function vlanParentOperational(intf){
  const parent=vlanParent(intf);
  return Boolean(parent && vlanCoreIsInterfaceOperational(parent));
}

function vlanClassifyIngress(incomingName, tag){
  const intf=findByName(incomingName);
  if(!intf) return {error:`Incoming interface ${incomingName} does not exist`};

  const hasTag=tag!==null && tag!==undefined && tag!=='';
  const numericTag=hasTag?Number(tag):null;
  if(hasTag && (!Number.isInteger(numericTag) || numericTag<1 || numericTag>4094)) return {error:'802.1Q VLAN tag must be 1-4094'};

  if(intf.type==='VLAN'){
    if(!intf.parent || !findByName(intf.parent)) return {error:`VLAN ${intf.name} has no valid parent interface`};
    if(!hasTag) return {error:`VLAN ${intf.name} expects 802.1Q tag ${intf.vlanId}`};
    if(numericTag!==Number(intf.vlanId)) return {error:`VLAN tag ${numericTag} does not match ${intf.name} (VLAN ${intf.vlanId})`};
    return {incoming:intf.name,originalIncoming:intf.name,parent:intf.parent,vlanId:Number(intf.vlanId),tag:numericTag};
  }

  if(hasTag){
    const child=state.interfaces.find(x=>x.type==='VLAN'&&x.parent===intf.name&&Number(x.vlanId)===numericTag);
    if(!child) return {error:`No VLAN interface on ${intf.name} is configured for tag ${numericTag}`};
    return {incoming:child.name,originalIncoming:intf.name,parent:intf.name,vlanId:numericTag,tag:numericTag};
  }

  return {incoming:intf.name,originalIncoming:intf.name,parent:'',vlanId:null,tag:null};
}

const vlanCoreIsInterfaceOperational=isInterfaceOperational;
isInterfaceOperational=function(intf){
  if(!vlanCoreIsInterfaceOperational(intf)) return false;
  if(intf?.type==='VLAN') return vlanParentOperational(intf);
  return true;
};

function vlanSyncGeneratedAddress(intf){
  if(!intf || intf.type!=='VLAN' || !intf.createAddressObject || intf.addressingMode!=='Manual') return;
  const cidr=vlanNetworkCidr(intf);if(!cidr)return;
  state.addresses ||= [];
  const generatedName=`${intf.name}_subnet`;
  let obj=state.addresses.find(a=>a.generatedForInterface===intf.name);
  if(!obj) obj=state.addresses.find(a=>a.name===generatedName && !a.builtin);
  if(obj){
    obj.name=generatedName;obj.type='Subnet';obj.value=cidr;obj.interface=intf.name;obj.generatedForInterface=intf.name;
  }else{
    state.addresses.push({id:uid(),name:generatedName,type:'Subnet',value:cidr,interface:intf.name,generatedForInterface:intf.name});
  }
}

function vlanSyncAllGeneratedAddresses(){
  state.interfaces.filter(i=>i.type==='VLAN').forEach(vlanSyncGeneratedAddress);
}

const vlanCoreSaveInterfaceEditor=saveInterfaceEditor;
saveInterfaceEditor=function(){
  const oldId=editingInterfaceId;
  const wantedName=$('editor-name')?.value.trim()||'';
  vlanCoreSaveInterfaceEditor();
  if(($('interface-editor-errors')?.textContent||'').trim()) return;
  const saved=oldId?findInterface(oldId):findByName(wantedName);
  if(saved?.type==='VLAN'){
    vlanSyncGeneratedAddress(saved);
    saveState();
    renderAll();
  }
};

const vlanCoreDeleteSelectedInterface=deleteSelectedInterface;
deleteSelectedInterface=function(){
  const target=findInterface(selectedInterfaceId);
  const generatedName=target?.type==='VLAN'?`${target.name}_subnet`:'';
  vlanCoreDeleteSelectedInterface();
  if(target && !findInterface(target.id) && generatedName){
    state.addresses=(state.addresses||[]).filter(a=>!(a.generatedForInterface===target.name || (a.name===generatedName && !a.builtin)));
    saveState();renderAll();
  }
};

const vlanCoreOpenInterfaceEditor=openInterfaceEditor;
openInterfaceEditor=function(item=null,type='Interface'){
  vlanCoreOpenInterfaceEditor(item,type);
  vlanEnsureEditorStatus();
  vlanUpdateEditorStatus();
};

function vlanEnsureEditorStatus(){
  if($('vlan-parent-runtime-status') || !$('control-editor-parent')) return;
  const note=document.createElement('div');
  note.id='vlan-parent-runtime-status';
  note.className='muted';
  $('control-editor-parent').append(note);
  $('editor-parent')?.addEventListener('change',vlanUpdateEditorStatus);
  $('editor-vlan-id')?.addEventListener('input',vlanUpdateEditorStatus);
  $('editor-ip')?.addEventListener('input',vlanUpdateEditorStatus);
  $('editor-mask')?.addEventListener('input',vlanUpdateEditorStatus);
}

function vlanUpdateEditorStatus(){
  const note=$('vlan-parent-runtime-status');if(!note)return;
  const type=$('editor-type')?.value;
  if(type!=='VLAN'){note.textContent='';return;}
  const parent=findByName($('editor-parent')?.value||'');
  const vlanId=Number($('editor-vlan-id')?.value||0);
  const ip=$('editor-ip')?.value.trim()||'';
  const mask=$('editor-mask')?.value.trim()||'';
  const cidr=isIPv4(ip)&&isValidNetmask(mask)?`${networkAddress(ip,mask)}/${maskToPrefix(mask)}`:'invalid subnet';
  note.textContent=parent?`Parent ${parent.name}: ${vlanCoreIsInterfaceOperational(parent)?'Up':'Down'} · 802.1Q tag ${vlanId||'—'} · connected route ${cidr}`:'Select a parent interface.';
}

renderInterfaces=function(){
  const body=$('interfaces-table-body');if(!body)return;
  const q=$('interface-search')?.value.trim().toLowerCase()||'',group=$('interface-group-select')?.value||'type';
  body.innerHTML='';let last='';
  const items=state.interfaces.filter(i=>[i.name,i.type,i.members,i.parent,i.vlanId,i.ip,i.alias,i.role,i.addressingMode,i.dynamicStatus].join(' ').toLowerCase().includes(q));
  items.forEach(i=>{
    if(group==='type'&&i.group!==last){const g=document.createElement('tr');g.className='group-row';g.innerHTML=`<td colspan="8">⊟ ${esc(i.group)} <span class="status-chip">${items.filter(x=>x.group===i.group).length}</span></td>`;body.append(g);last=i.group;}
    const tr=document.createElement('tr');if(i.id===selectedInterfaceId)tr.classList.add('selected');
    const access=(i.access||[]).map(a=>`<span class="access-chip">${esc(a)}</span>`).join('');
    const ref=getRefCount(i);
    const dynamicInfo=i.addressingMode!=='Manual'?`<div class="muted">${esc(i.addressingMode)} · ${esc(i.dynamicStatus||i.pppoeStatus||'')}</div>`:'';
    const vlanInfo=i.type==='VLAN'?`<div class="muted">802.1Q · VLAN ${Number(i.vlanId)||'—'} · parent ${esc(i.parent||'—')}</div>`:'';
    const members=i.type==='VLAN'?`${esc(i.parent||'—')} <span class="status-chip">VLAN ${Number(i.vlanId)||'—'}</span>`:esc(i.members||'');
    const operational=isInterfaceOperational(i);
    const parentNote=i.type==='VLAN'&&!vlanParentOperational(i)?`<div class="muted status-deny">Parent down</div>`:'';
    tr.innerHTML=`<td>${operational?'▣':'▤'} <strong>${esc(i.name)}</strong>${i.alias?`<div class="muted">${esc(i.alias)}</div>`:''}${parentNote}</td><td>${esc(i.type)}${dynamicInfo}${vlanInfo}</td><td>${members}</td><td>${esc(i.ip)}/${esc(i.mask)}</td><td>${access||'-'}</td><td>${esc(i.dhcpClients||'')}</td><td>${esc(i.dhcpRange||'')}</td><td><button class="text-link interface-ref-button" type="button">${ref}</button></td>`;
    tr.addEventListener('click',e=>{if(e.target.classList.contains('interface-ref-button')){showReferences(i);return;}selectedInterfaceId=i.id;renderInterfaces();updateButtons();});
    tr.addEventListener('dblclick',()=>openInterfaceEditor(i));body.append(tr);
  });
  updateButtons();
};

function vlanHostSuggestion(intf){
  if(!intf||!isIPv4(intf.ip)||!isValidNetmask(intf.mask))return '';
  const prefix=maskToPrefix(intf.mask);if(prefix>=31)return intf.ip;
  const net=ipToInt(networkAddress(intf.ip,intf.mask));
  const broadcast=prefix===0?0xffffffff:(net + Math.pow(2,32-prefix)-1)>>>0;
  for(let offset=10;offset<30;offset++){
    const candidate=(net+offset)>>>0;
    if(candidate>=broadcast)break;
    const ip=[24,16,8,0].map(s=>(candidate>>>s)&255).join('.');
    if(ip!==intf.ip)return ip;
  }
  return intf.ip;
}

openTrafficModal=function(){
  openModal('Test Traffic',`<div class="form-grid">
    <div class="field"><label for="test-source">Source IP</label><input id="test-source" value="192.168.1.100"></div>
    <div class="field"><label for="test-destination">Destination IP</label><input id="test-destination" value="8.8.8.8"></div>
    <div class="field"><label for="test-incoming">Incoming Interface / Trunk</label><select id="test-incoming">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="test-vlan-tag">802.1Q VLAN Tag</label><input id="test-vlan-tag" type="number" min="1" max="4094" placeholder="untagged"></div>
    <div class="field"><label for="test-outgoing">Expected Outgoing Interface</label><select id="test-outgoing">${state.interfaces.map(i=>`<option>${esc(i.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="test-service">Service</label><select id="test-service"><option>PING</option><option>HTTP</option><option>HTTPS</option><option>DNS</option><option>RDP</option></select></div>
    <div class="field full"><label>Simulator Logic</label><div id="test-vlan-help" class="muted">802.1Q classification → Incoming Interface → Reverse Path → Route → Policy → NAT → Log</div></div>
  </div>`,[{label:'Cancel',className:'btn-secondary',action:closeModal},{label:'Run Test',className:'btn-primary',action:runTraffic}]);
  if(findByName('lan'))$('test-incoming').value='lan';
  if(findByName('wan'))$('test-outgoing').value='wan';
  $('test-incoming')?.addEventListener('change',vlanSyncTrafficInputs);
  vlanSyncTrafficInputs();
};

function vlanSyncTrafficInputs(){
  const incoming=findByName($('test-incoming')?.value||'');if(!incoming)return;
  const tag=$('test-vlan-tag');const help=$('test-vlan-help');
  if(incoming.type==='VLAN'){
    tag.value=String(incoming.vlanId||'');tag.placeholder=String(incoming.vlanId||'');
    const host=vlanHostSuggestion(incoming);if(host)$('test-source').value=host;
    if(help)help.textContent=`${incoming.name} is VLAN ${incoming.vlanId} on ${incoming.parent}. The matching 802.1Q tag is required before policy lookup.`;
  }else{
    tag.value='';tag.placeholder=state.interfaces.some(v=>v.type==='VLAN'&&v.parent===incoming.name)?'e.g. 10':'untagged';
    if(help)help.textContent=state.interfaces.some(v=>v.type==='VLAN'&&v.parent===incoming.name)?`Enter a VLAN tag to classify traffic from trunk ${incoming.name} into a child VLAN, or leave blank for untagged traffic.`:'Untagged ingress → Reverse Path → Route → Policy → NAT → Log';
  }
}

const vlanCoreEvaluateTraffic=evaluateTraffic;
evaluateTraffic=function(args){
  const classified=vlanClassifyIngress(args.incoming,args.vlanTag);
  if(classified.error)return{action:'DENY',policyId:'-',reason:classified.error};
  vlanLastIngress=classified;
  return vlanCoreEvaluateTraffic({...args,incoming:classified.incoming});
};

runTraffic=function(){
  const source=$('test-source').value.trim(),destination=$('test-destination').value.trim();
  const requestedIncoming=$('test-incoming').value,expectedOutgoing=$('test-outgoing').value,service=$('test-service').value;
  const rawTag=$('test-vlan-tag')?.value.trim()||'';
  const vlanTag=rawTag===''?null:Number(rawTag);
  if(!isIPv4(source)||!isIPv4(destination)){alert('Enter valid source and destination IPv4 addresses.');return;}
  if(vlanTag!==null&&(!Number.isInteger(vlanTag)||vlanTag<1||vlanTag>4094)){alert('802.1Q VLAN tag must be 1-4094.');return;}

  vlanLastIngress=null;
  const result=evaluateTraffic({source,destination,incoming:requestedIncoming,outgoing:expectedOutgoing,service,vlanTag});
  const ingress=vlanLastIngress||{incoming:requestedIncoming,originalIncoming:requestedIncoming,parent:'',vlanId:null,tag:vlanTag};
  const route=findBestRoute(destination);const actualOutgoing=result.outgoing||route?.interface||expectedOutgoing;
  const policy=state.policies.find(p=>String(p.id)===String(result.policyId));
  const seed=hashText(`${source}|${destination}|${service}|${Date.now()}`);
  state.logs.push({
    id:uid(),timestamp:Date.now(),time:new Date().toLocaleTimeString(),action:result.action,policy:result.policyId,
    policyName:policy?.name||(result.policyId==='-'?'Implicit Deny':'INCOMING'),source,destination,service,
    incoming:ingress.incoming,outgoing:actualOutgoing,nat:Boolean(policy?.nat),application:applicationFromService(service),
    vlanId:ingress.vlanId,vlanTag:ingress.tag,ingressParent:ingress.parent,originalIncoming:ingress.originalIncoming,
    bytesSent:result.action==='ACCEPT'?((seed%700)+1)*1024:0,
    bytesReceived:result.action==='ACCEPT'?(((seed>>>5)%1400)+1)*1024:0,
    reason:result.reason
  });
  state.logs=state.logs.slice(-500);saveState();closeModal();renderAll();alert(`${result.action}\n${result.reason}`);
};

if(typeof showForwardLogDetails==='function'){
  const vlanCoreShowForwardLogDetails=showForwardLogDetails;
  showForwardLogDetails=function(log){
    vlanCoreShowForwardLogDetails(log);
    const grid=document.querySelector('#modal-body .forti-log-detail-grid');
    if(!grid||!log)return;
    if(log.vlanId!==null&&log.vlanId!==undefined){
      const dt=document.createElement('dt');dt.textContent='VLAN';
      const dd=document.createElement('dd');dd.textContent=`${log.vlanId}${log.ingressParent?` on ${log.ingressParent}`:''}${log.vlanTag?` · tag ${log.vlanTag}`:''}`;
      grid.append(dt,dd);
    }
  };
}

if(typeof poPolicyModal==='function'){
  const vlanCorePolicyModal=poPolicyModal;
  poPolicyModal=function(policy=null){
    vlanCorePolicyModal(policy);
    const form=$('po-name')?.closest('.form-grid');if(!form||$('po-vlan-policy-note'))return;
    const field=document.createElement('div');field.id='po-vlan-policy-note';field.className='field full';
    field.innerHTML='<label id="po-vlan-policy-note-label">VLAN / NAT guidance</label><div id="po-vlan-policy-note-text" class="muted"></div>';
    form.append(field);
    const sync=()=>{
      const from=findByName($('po-from')?.value||''),to=findByName($('po-to')?.value||'');
      const nat=$('po-nat')?.checked;
      let text='';
      if(from?.type==='VLAN'&&to?.type==='VLAN') text=`Inter-VLAN ${from.name} → ${to.name}: an explicit policy is required. NAT is normally OFF${nat?' — NAT is currently ON.':''}`;
      else if(from?.type==='VLAN'&&to?.role==='WAN') text=`${from.name} → WAN: Internet traffic normally uses NAT ON.`;
      else if(from?.type==='VLAN') text=`Traffic from ${from.name} is isolated unless an explicit matching policy allows it.`;
      $('po-vlan-policy-note-text').textContent=text||'Select VLAN interfaces to see inter-VLAN guidance.';
    };
    ['po-from','po-to','po-nat'].forEach(id=>$(id)?.addEventListener('change',sync));sync();
  };
}

const vlanCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim();
  const match=text.match(/^show system interface\s+(.+)$/i);
  if(match){
    const name=match[1].replace(/^['\"]|['\"]$/g,'').trim();
    const intf=findByName(name);cli(`FG-SIM-01 # ${text}`);
    if(!intf){cli(`Interface ${name} not found.`);return;}
    const lines=['config system interface',`    edit "${intf.name}"`];
    if(isIPv4(intf.ip)&&isIPv4(intf.mask)&&intf.ip!=='0.0.0.0')lines.push(`        set ip ${intf.ip} ${intf.mask}`);
    if((intf.access||[]).length)lines.push(`        set allowaccess ${(intf.access||[]).map(x=>x.toLowerCase().replace(/[^a-z0-9-]/g,'')).join(' ')}`);
    if(intf.role)lines.push(`        set role ${String(intf.role).toLowerCase()}`);
    if(intf.type==='VLAN'){lines.push(`        set interface "${intf.parent}"`,`        set vlanid ${intf.vlanId}`);}
    lines.push('    next','end');cli(lines.join('\n'));return;
  }
  vlanCoreRunCli(text);
};

vlanSyncAllGeneratedAddresses();
saveState();
