/* FortiOS 7.0-style Packet Capture and Debug Flow simulator. */
function pcInitState(){
  state.packetCapture ||= {};
  const capture=state.packetCapture;
  capture.active=Boolean(capture.active);
  capture.interface ||= 'any';
  capture.host ||= '';
  capture.protocol ||= 'any';
  capture.port ||= '';
  capture.verbosity=Number(capture.verbosity||4);
  capture.count=Number(capture.count||50);
  capture.packets=Array.isArray(capture.packets)?capture.packets:[];
  capture.debug ||= {};
  capture.debug.enabled=Boolean(capture.debug.enabled);
  capture.debug.filterAddr ||= '';
  capture.debug.showFunctionName=capture.debug.showFunctionName!==false;
  capture.debug.traceLimit=Number(capture.debug.traceLimit||20);
  capture.debug.remaining=Number.isFinite(Number(capture.debug.remaining))?Number(capture.debug.remaining):capture.debug.traceLimit;
  capture.debug.traces=Array.isArray(capture.debug.traces)?capture.debug.traces:[];
  saveState();
}

function pcPrepareNavigation(){
  const nav=$('nav-packet-capture');
  if(!nav)return;
  nav.dataset.view='packet-capture';
  delete nav.dataset.title;
}

function pcPrepareView(){
  const main=$('main-content');if(!main||$('view-packet-capture'))return;
  main.insertAdjacentHTML('beforeend',`
    <section id="view-packet-capture" class="app-view">
      <div id="packet-capture-header" class="page-heading-row"><h1 id="packet-capture-title">Packet Capture</h1></div>

      <section id="packet-capture-settings-section" class="forti-form-section">
        <h2 id="packet-capture-settings-title">Packet Capture</h2>
        <div id="packet-capture-settings-body" class="forti-form-body">
          <div id="field-pc-interface" class="forti-field-row"><label id="label-pc-interface" for="pc-interface">Interface</label><div id="control-pc-interface"><select id="pc-interface"></select></div></div>
          <div id="field-pc-host" class="forti-field-row"><label id="label-pc-host" for="pc-host">Host Filter</label><div id="control-pc-host"><input id="pc-host" type="text" placeholder="192.168.1.100 or blank for any"></div></div>
          <div id="field-pc-protocol" class="forti-field-row"><label id="label-pc-protocol" for="pc-protocol">Protocol</label><div id="control-pc-protocol"><select id="pc-protocol"><option value="any">Any</option><option value="icmp">ICMP</option><option value="tcp">TCP</option><option value="udp">UDP</option></select></div></div>
          <div id="field-pc-port" class="forti-field-row"><label id="label-pc-port" for="pc-port">Port</label><div id="control-pc-port"><input id="pc-port" type="number" min="1" max="65535" placeholder="Any"></div></div>
          <div id="field-pc-verbosity" class="forti-field-row"><label id="label-pc-verbosity" for="pc-verbosity">Verbosity</label><div id="control-pc-verbosity"><select id="pc-verbosity"><option value="1">1 - Header</option><option value="2">2 - Header + payload</option><option value="3">3 - Ethernet header</option><option value="4" selected>4 - Interface + protocol</option><option value="5">5 - Extended</option><option value="6">6 - Extended + timestamps</option></select></div></div>
          <div id="field-pc-count" class="forti-field-row"><label id="label-pc-count" for="pc-count">Packet Count</label><div id="control-pc-count"><input id="pc-count" type="number" min="1" max="500" value="50"></div></div>
        </div>
      </section>

      <div id="packet-capture-toolbar" class="toolbar">
        <button id="pc-start-button" class="btn-primary" type="button">▶ Start</button>
        <button id="pc-stop-button" class="btn-secondary" type="button">■ Stop</button>
        <button id="pc-clear-button" class="btn-secondary" type="button">Clear</button>
        <button id="pc-test-button" class="btn-secondary" type="button">▶ Test Traffic</button>
        <button id="pc-export-button" class="btn-secondary" type="button">⬇ Export</button>
      </div>
      <div id="packet-capture-status" class="muted">Capture stopped.</div>
      <div id="packet-capture-table-wrap" class="table-wrap full-table-wrap">
        <table id="packet-capture-table" class="data-table"><thead><tr><th>Time</th><th>Interface</th><th>Direction</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Length</th><th>Info</th></tr></thead><tbody id="packet-capture-body"></tbody></table>
      </div>

      <section id="debug-flow-section" class="forti-form-section">
        <h2 id="debug-flow-title">Debug Flow</h2>
        <div id="debug-flow-settings" class="forti-form-body">
          <div id="field-debug-address" class="forti-field-row"><label id="label-debug-address" for="debug-address">Filter Address</label><div id="control-debug-address"><input id="debug-address" type="text" placeholder="192.168.1.100"></div></div>
          <div id="field-debug-function" class="forti-field-row"><label id="label-debug-function">Show Function Name</label><div id="control-debug-function"><label id="debug-function-switch" class="forti-switch"><input id="debug-function" type="checkbox" checked><span></span></label></div></div>
          <div id="field-debug-count" class="forti-field-row"><label id="label-debug-count" for="debug-count">Trace Count</label><div id="control-debug-count"><input id="debug-count" type="number" min="1" max="200" value="20"></div></div>
        </div>
      </section>
      <div id="debug-flow-toolbar" class="toolbar">
        <button id="debug-enable-button" class="btn-primary" type="button">Enable Debug</button>
        <button id="debug-disable-button" class="btn-secondary" type="button">Disable</button>
        <button id="debug-reset-button" class="btn-secondary" type="button">Reset</button>
      </div>
      <div id="debug-flow-status" class="muted">Debug disabled.</div>
      <div id="debug-flow-table-wrap" class="table-wrap full-table-wrap">
        <table id="debug-flow-table" class="data-table"><thead><tr><th>#</th><th>Function</th><th>Result</th><th>Detail</th></tr></thead><tbody id="debug-flow-body"></tbody></table>
      </div>
    </section>`);
}

function pcBind(){
  $('pc-start-button')?.addEventListener('click',pcStart);
  $('pc-stop-button')?.addEventListener('click',pcStop);
  $('pc-clear-button')?.addEventListener('click',pcClear);
  $('pc-test-button')?.addEventListener('click',openTrafficModal);
  $('pc-export-button')?.addEventListener('click',pcExport);
  $('debug-enable-button')?.addEventListener('click',pcDebugEnable);
  $('debug-disable-button')?.addEventListener('click',pcDebugDisable);
  $('debug-reset-button')?.addEventListener('click',pcDebugReset);
}

function pcPopulateControls(){
  const capture=state.packetCapture,select=$('pc-interface');
  if(select){
    const current=capture.interface||'any';
    select.innerHTML=['any',...state.interfaces.map(i=>i.name)].map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===current)?current:'any';
  }
  if($('pc-host'))$('pc-host').value=capture.host||'';
  if($('pc-protocol'))$('pc-protocol').value=capture.protocol||'any';
  if($('pc-port'))$('pc-port').value=capture.port||'';
  if($('pc-verbosity'))$('pc-verbosity').value=String(capture.verbosity||4);
  if($('pc-count'))$('pc-count').value=String(capture.count||50);
  if($('debug-address'))$('debug-address').value=capture.debug.filterAddr||'';
  if($('debug-function'))$('debug-function').checked=capture.debug.showFunctionName!==false;
  if($('debug-count'))$('debug-count').value=String(capture.debug.traceLimit||20);
}

function pcStart(){
  const host=$('pc-host').value.trim(),port=$('pc-port').value.trim(),count=Number($('pc-count').value||50);
  if(host&&!isIPv4(host)){alert('Host filter must be a valid IPv4 address.');return;}
  if(port&&(!Number.isInteger(Number(port))||Number(port)<1||Number(port)>65535)){alert('Port must be 1-65535.');return;}
  if(!Number.isInteger(count)||count<1||count>500){alert('Packet count must be 1-500.');return;}
  Object.assign(state.packetCapture,{active:true,interface:$('pc-interface').value,host,protocol:$('pc-protocol').value,port,verbosity:Number($('pc-verbosity').value||4),count});
  saveState();pcRenderAll();
}
function pcStop(){state.packetCapture.active=false;saveState();pcRenderAll();}
function pcClear(){state.packetCapture.packets=[];saveState();pcRenderAll();}

function pcPacketMatches(packet){
  const c=state.packetCapture;
  if(c.interface!=='any'&&packet.interface!==c.interface)return false;
  if(c.host&&packet.source!==c.host&&packet.destination!==c.host)return false;
  if(c.protocol!=='any'&&packet.protocol!==c.protocol)return false;
  if(c.port&&Number(packet.port)!==Number(c.port))return false;
  return true;
}

function pcServiceInfo(service){
  const s=String(service||'').toUpperCase();
  if(s==='PING')return{protocol:'icmp',port:'',info:'ICMP echo'};
  if(s==='DNS')return{protocol:'udp',port:53,info:'DNS query'};
  if(s==='HTTP')return{protocol:'tcp',port:80,info:'TCP HTTP'};
  if(s==='HTTPS')return{protocol:'tcp',port:443,info:'TCP HTTPS'};
  if(s==='RDP')return{protocol:'tcp',port:3389,info:'TCP RDP'};
  return{protocol:'ip',port:'',info:s||'IP'};
}

function pcRecordFromLog(log){
  const c=state.packetCapture;if(!c.active||!log)return;
  const svc=pcServiceInfo(log.service),seed=hashText(`${log.id}|${log.source}|${log.destination}`);
  const incoming=log.originalIncoming||log.incoming||'lan',outgoing=log.outgoing||'wan';
  const request={id:uid(),timestamp:Date.now(),interface:incoming,direction:'in',source:log.source,destination:log.destination,protocol:svc.protocol,port:svc.port,length:64+(seed%700),info:`${svc.info}${log.vlanTag?` · 802.1Q vlan ${log.vlanTag}`:''}`};
  const packets=[request];
  if(log.action==='ACCEPT'){
    const policy=state.policies.find(p=>String(p.id)===String(log.policy));
    const outIf=findByName(outgoing),natSource=policy?.nat&&outIf?.ip&&outIf.ip!=='0.0.0.0'?outIf.ip:log.source;
    packets.push({id:uid(),timestamp:Date.now()+1,interface:outgoing,direction:'out',source:natSource,destination:log.destination,protocol:svc.protocol,port:svc.port,length:72+((seed>>>4)%900),info:`${svc.info}${policy?.nat?` · SNAT ${log.source} → ${natSource}`:''}`});
    packets.push({id:uid(),timestamp:Date.now()+12,interface:outgoing,direction:'in',source:log.destination,destination:natSource,protocol:svc.protocol,port:svc.port,length:84+((seed>>>8)%1100),info:`${svc.info} reply`});
    packets.push({id:uid(),timestamp:Date.now()+13,interface:incoming,direction:'out',source:log.destination,destination:log.source,protocol:svc.protocol,port:svc.port,length:84+((seed>>>8)%1100),info:`${svc.info} reply${policy?.nat?' · de-NAT':''}`});
  }else request.info+=` · dropped: ${log.reason||'deny'}`;
  for(const packet of packets){
    if(!pcPacketMatches(packet))continue;
    c.packets.push(packet);
    if(c.packets.length>=c.count){c.active=false;break;}
  }
  c.packets=c.packets.slice(-500);saveState();
}

function pcRenderPackets(){
  const body=$('packet-capture-body');if(!body)return;body.innerHTML='';
  [...state.packetCapture.packets].reverse().forEach(packet=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${esc(new Date(packet.timestamp).toLocaleTimeString())}</td><td>${esc(packet.interface)}</td><td>${packet.direction==='in'?'← in':'→ out'}</td><td>${esc(packet.source)}</td><td>${esc(packet.destination)}</td><td>${esc(String(packet.protocol).toUpperCase())}${packet.port?`/${packet.port}`:''}</td><td>${packet.length}</td><td>${esc(packet.info)}</td>`;
    body.append(tr);
  });
}

function pcRenderDebug(){
  const dbg=state.packetCapture.debug,body=$('debug-flow-body');if(!body)return;body.innerHTML='';
  const last=dbg.traces[dbg.traces.length-1];
  (last?.steps||[]).forEach((step,index)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${index+1}</td><td>${esc(dbg.showFunctionName===false?'—':step.fn)}</td><td class="${step.result==='DENY'?'status-deny':step.result==='ACCEPT'?'status-accept':''}">${esc(step.result)}</td><td>${esc(step.detail)}</td>`;
    body.append(tr);
  });
  if($('debug-flow-status'))$('debug-flow-status').textContent=dbg.enabled?`Debug enabled · filter ${dbg.filterAddr||'any'} · ${Math.max(0,dbg.remaining)} trace(s) remaining`:'Debug disabled.';
}

function pcRenderStatus(){
  const c=state.packetCapture;
  if($('packet-capture-status'))$('packet-capture-status').textContent=c.active?`Running · interface ${c.interface} · host ${c.host||'any'} · protocol ${c.protocol} · ${c.packets.length}/${c.count} packets`:`Stopped · ${c.packets.length} packet(s) stored.`;
  if($('pc-start-button'))$('pc-start-button').disabled=c.active;
  if($('pc-stop-button'))$('pc-stop-button').disabled=!c.active;
}
function pcRenderAll(){pcPopulateControls();pcRenderStatus();pcRenderPackets();pcRenderDebug();}

function pcDebugEnable(){
  const addr=$('debug-address').value.trim(),limit=Number($('debug-count').value||20);
  if(addr&&!isIPv4(addr)){alert('Debug filter address must be a valid IPv4 address.');return;}
  if(!Number.isInteger(limit)||limit<1||limit>200){alert('Trace count must be 1-200.');return;}
  Object.assign(state.packetCapture.debug,{enabled:true,filterAddr:addr,showFunctionName:$('debug-function').checked,traceLimit:limit,remaining:limit});
  saveState();pcRenderAll();
}
function pcDebugDisable(){state.packetCapture.debug.enabled=false;saveState();pcRenderAll();}
function pcDebugReset(){
  state.packetCapture.debug={enabled:false,filterAddr:'',showFunctionName:true,traceLimit:20,remaining:20,traces:[]};
  saveState();pcRenderAll();
}

function pcBuildDebugTrace(args,result){
  const steps=[];
  const classified=typeof vlanClassifyIngress==='function'?vlanClassifyIngress(args.incoming,args.vlanTag):{incoming:args.incoming};
  const incoming=classified.error?args.incoming:(classified.incoming||args.incoming);
  steps.push({fn:'print_pkt_detail',result:'INFO',detail:`vd-root received ${args.service} ${args.source} → ${args.destination} on ${incoming}`});
  if(args.vlanTag!==null&&args.vlanTag!==undefined&&args.vlanTag!=='')steps.push({fn:'vlan_input',result:classified.error?'DENY':'OK',detail:classified.error||`802.1Q tag ${args.vlanTag} classified to ${incoming}`});
  const reverse=findBestRoute(args.source);
  steps.push({fn:'iprope_in_check',result:reverse&&reverse.interface===incoming?'OK':'DENY',detail:reverse?`reverse route ${reverse.destination} via ${reverse.interface}`:`no reverse route for ${args.source}`});
  const route=findBestRoute(args.destination);
  steps.push({fn:'vf_ip_route_input_common',result:route?'OK':'DENY',detail:route?`${args.destination} matched ${route.destination} via ${route.interface}`:`no route to ${args.destination}`});
  const policy=state.policies.find(p=>String(p.id)===String(result.policyId));
  steps.push({fn:'fw_forward_handler',result:policy?(policy.action||result.action):'DENY',detail:policy?`policy ${policy.id} ${policy.name}`:'implicit deny / no matching policy'});
  if(policy&&result.reason?.includes('security'))steps.push({fn:'utm_inspection',result:result.action,detail:result.reason.split(';').filter(x=>x.includes('security')||x.includes('blocked')).join('; ')||'security profile inspection'});
  if(policy?.nat)steps.push({fn:'__ip_session_run_tuple',result:'SNAT',detail:`source NAT enabled on policy ${policy.name}`});
  steps.push({fn:'ip_session_run_all',result:result.action,detail:result.reason||result.action});
  return{id:uid(),timestamp:Date.now(),source:args.source,destination:args.destination,incoming,service:args.service,result:result.action,steps};
}

function pcShouldTrace(args){
  const dbg=state.packetCapture.debug;if(!dbg.enabled||dbg.remaining<=0)return false;
  return !dbg.filterAddr||dbg.filterAddr===args.source||dbg.filterAddr===args.destination;
}
function pcEmitCliTrace(trace){
  if(typeof cli!=='function')return;
  trace.steps.forEach((step,index)=>{
    const fn=state.packetCapture.debug.showFunctionName===false?'':`func=${step.fn} `;
    cli(`id=20085 trace_id=${trace.id.slice(-6)} msg="${fn}${step.result}: ${step.detail}"`);
  });
}

const pcCoreEvaluateTraffic=evaluateTraffic;
evaluateTraffic=function(args){
  const result=pcCoreEvaluateTraffic(args);
  if(pcShouldTrace(args)){
    const trace=pcBuildDebugTrace(args,result),dbg=state.packetCapture.debug;
    dbg.traces.push(trace);dbg.traces=dbg.traces.slice(-100);dbg.remaining=Math.max(0,dbg.remaining-1);
    pcEmitCliTrace(trace);saveState();pcRenderDebug();
  }
  return result;
};

const pcCoreRunTraffic=runTraffic;
runTraffic=function(){
  const before=state.logs.length;
  pcCoreRunTraffic();
  if(state.logs.length>before)pcRecordFromLog(state.logs[state.logs.length-1]);
  pcRenderAll();
};

function pcSnifferOutput(interfaceName,filterText,verbosity,count){
  let rows=[...state.packetCapture.packets];
  if(interfaceName&&interfaceName!=='any')rows=rows.filter(p=>p.interface===interfaceName);
  const host=String(filterText||'').match(/host\s+(\d+\.\d+\.\d+\.\d+)/i)?.[1]||'';
  const port=String(filterText||'').match(/port\s+(\d+)/i)?.[1]||'';
  if(host)rows=rows.filter(p=>p.source===host||p.destination===host);
  if(port)rows=rows.filter(p=>Number(p.port)===Number(port));
  if(Number(count)>0)rows=rows.slice(-Number(count));
  if(!rows.length)return '0 packets captured';
  return rows.map((p,index)=>`${(index*0.0124).toFixed(6)} ${p.interface} ${p.direction} ${p.source}${p.port?`.${p.port}`:''} -> ${p.destination}${p.port?`.${p.port}`:''}: ${String(p.protocol).toUpperCase()} ${p.info}${Number(verbosity)>=4?` length ${p.length}`:''}`).join('\n');
}

const pcCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim(),lower=text.toLowerCase(),dbg=state.packetCapture.debug;
  let match;
  if(lower==='diagnose debug reset'){
    cli(`FG-SIM-01 # ${text}`);pcDebugReset();cli('Debug settings reset.');return;
  }
  if((match=text.match(/^diagnose debug flow filter addr\s+(\d+\.\d+\.\d+\.\d+)$/i))){
    cli(`FG-SIM-01 # ${text}`);if(!isIPv4(match[1])){cli('Invalid IPv4 address.');return;}dbg.filterAddr=match[1];saveState();pcRenderAll();cli(`Debug flow address filter: ${match[1]}`);return;
  }
  if(lower==='diagnose debug flow filter clear'){
    cli(`FG-SIM-01 # ${text}`);dbg.filterAddr='';saveState();pcRenderAll();cli('Debug flow filters cleared.');return;
  }
  if((match=text.match(/^diagnose debug flow show function-name\s+(enable|disable)$/i))){
    cli(`FG-SIM-01 # ${text}`);dbg.showFunctionName=match[1].toLowerCase()==='enable';saveState();pcRenderAll();cli(`Function names ${dbg.showFunctionName?'enabled':'disabled'}.`);return;
  }
  if((match=text.match(/^diagnose debug flow trace start\s+(\d+)$/i))){
    cli(`FG-SIM-01 # ${text}`);dbg.traceLimit=Math.max(1,Math.min(200,Number(match[1])));dbg.remaining=dbg.traceLimit;saveState();pcRenderAll();cli(`Trace count set to ${dbg.traceLimit}.`);return;
  }
  if(lower==='diagnose debug flow trace stop'){
    cli(`FG-SIM-01 # ${text}`);dbg.remaining=0;saveState();pcRenderAll();cli('Debug flow trace stopped.');return;
  }
  if(lower==='diagnose debug enable'){
    cli(`FG-SIM-01 # ${text}`);dbg.enabled=true;if(dbg.remaining<=0)dbg.remaining=dbg.traceLimit||20;saveState();pcRenderAll();cli('Debug output enabled. Generate traffic to see flow traces.');return;
  }
  if(lower==='diagnose debug disable'){
    cli(`FG-SIM-01 # ${text}`);dbg.enabled=false;saveState();pcRenderAll();cli('Debug output disabled.');return;
  }
  if((match=text.match(/^diagnose sniffer packet\s+(\S+)\s+['\"]([^'\"]*)['\"]\s+(\d+)\s+(\d+)\s+l$/i))){
    cli(`FG-SIM-01 # ${text}`);cli(pcSnifferOutput(match[1],match[2],Number(match[3]),Number(match[4])));return;
  }
  pcCoreRunCli(text);
};

function pcExport(){
  const rows=state.packetCapture.packets;
  const text=rows.map(p=>`${new Date(p.timestamp).toISOString()} ${p.interface} ${p.direction} ${p.source} -> ${p.destination} ${p.protocol}${p.port?`/${p.port}`:''} len=${p.length} ${p.info}`).join('\n');
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='fortigate-packet-capture.txt';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}

const pcCoreShowView=showView;
showView=function(name){
  pcCoreShowView(name);
  if(name==='packet-capture'){
    $('nav-network')?.classList.add('active');
    $('nav-packet-capture')?.classList.add('active');
    pcRenderAll();
  }
};

const pcCoreRenderAll=renderAll;
renderAll=function(){pcCoreRenderAll();pcRenderAll();};

pcInitState();
pcPrepareNavigation();
pcPrepareView();
document.addEventListener('DOMContentLoaded',()=>{pcBind();pcRenderAll();});
