/* FortiOS 7.0-style Log & Report enhancement. Loaded after app-core.js. */
let fortiLogFilters = [];
let fortiSelectedLogId = null;

function prepareFortiLogReport(){
  injectFortiLogStyles();
  prepareLogReportNavigation();
  prepareForwardTrafficView();
}

function prepareLogReportNavigation(){
  const old = document.getElementById('nav-logs');
  if(!old || document.getElementById('log-report-group')) return;

  const group = document.createElement('div');
  group.id = 'log-report-group';
  group.className = 'nav-group open';
  group.innerHTML = `
    <button id="nav-log-report" class="nav-item nav-parent" type="button" aria-expanded="true" aria-controls="log-report-subnav">
      <span class="nav-icon">▥</span><span>Log & Report</span><span class="nav-chevron">⌄</span>
    </button>
    <div id="log-report-subnav" class="subnav forti-log-subnav">
      <button id="nav-forward-traffic" class="subnav-item" data-view="logs" type="button">Forward Traffic <span class="forti-nav-star">☆</span></button>
      <button id="nav-local-traffic" class="subnav-item" data-view="placeholder" data-title="Local Traffic" type="button">Local Traffic</button>
      <button id="nav-sniffer-traffic" class="subnav-item" data-view="placeholder" data-title="Sniffer Traffic" type="button">Sniffer Traffic</button>
      <button id="nav-events" class="subnav-item forti-log-divider" data-view="placeholder" data-title="Events" type="button">Events</button>
      <button id="nav-antivirus-log" class="subnav-item" data-view="placeholder" data-title="AntiVirus" type="button">AntiVirus</button>
      <button id="nav-web-filter-log" class="subnav-item" data-view="placeholder" data-title="Web Filter" type="button">Web Filter</button>
      <button id="nav-ssl-log" class="subnav-item" data-view="placeholder" data-title="SSL" type="button">SSL</button>
      <button id="nav-dns-query-log" class="subnav-item" data-view="placeholder" data-title="DNS Query" type="button">DNS Query</button>
      <button id="nav-file-filter-log" class="subnav-item" data-view="placeholder" data-title="File Filter" type="button">File Filter</button>
      <button id="nav-application-control-log" class="subnav-item" data-view="placeholder" data-title="Application Control" type="button">Application Control</button>
      <button id="nav-anomaly-log" class="subnav-item" data-view="placeholder" data-title="Anomaly" type="button">Anomaly</button>
      <button id="nav-log-settings" class="subnav-item forti-log-divider" data-view="placeholder" data-title="Log Settings" type="button">Log Settings</button>
      <button id="nav-threat-weight" class="subnav-item" data-view="placeholder" data-title="Threat Weight" type="button">Threat Weight</button>
    </div>`;
  old.replaceWith(group);
}

function prepareForwardTrafficView(){
  const view = document.getElementById('view-logs');
  if(!view || document.getElementById('forward-log-toolbar')) return;
  view.innerHTML = `
    <div id="forward-log-toolbar" class="forti-log-toolbar">
      <button id="log-refresh-button" class="forti-square-button" type="button" title="Refresh" aria-label="Refresh">↻</button>
      <button id="log-export-button" class="forti-square-button" type="button" title="Export CSV" aria-label="Export CSV">⬇</button>
      <div id="log-filter-chips" class="forti-log-filter-chips"></div>
      <button id="log-add-filter-button" class="forti-add-filter" type="button">⊕ Add Filter</button>
      <div id="log-toolbar-spacer"></div>
      <button id="log-details-button" class="btn-secondary" type="button" disabled>▣ Details</button>
    </div>
    <div id="forward-log-table-wrap" class="forti-forward-table-wrap">
      <table id="forward-log-table" class="forti-forward-table">
        <thead>
          <tr>
            <th id="forward-policy-heading">Policy Name</th>
            <th id="forward-time-heading">Date/Time</th>
            <th id="forward-source-heading">Source</th>
            <th id="forward-destination-heading">Destination</th>
            <th id="forward-application-heading">Application Name</th>
            <th id="forward-result-heading">Result</th>
          </tr>
        </thead>
        <tbody id="logs-table-body"></tbody>
      </table>
    </div>
    <div id="forward-log-footer" class="forti-log-footer">
      <span id="log-visible-count">0 logs</span>
      <span id="log-storage-note">Forward Traffic · simulator</span>
    </div>`;
}

function injectFortiLogStyles(){
  if(document.getElementById('forti-log-enhancement-styles')) return;
  const style = document.createElement('style');
  style.id = 'forti-log-enhancement-styles';
  style.textContent = `
    #log-report-group .forti-log-subnav{background:#3a3a3a;}
    #log-report-group .subnav-item{position:relative;min-height:38px;padding-left:28px;font-size:15px;color:#f3f3f3;}
    #log-report-group .subnav-item.active{background:#4a9c5b;color:#fff;font-weight:600;}
    #log-report-group .forti-log-divider{border-top:1px solid #5d5d5d;}
    #log-report-group .forti-nav-star{position:absolute;right:8px;font-size:18px;line-height:1;}
    #view-logs{padding:0!important;margin:-16px;background:#fff;min-height:calc(100vh - 72px);}
    #forward-log-toolbar{height:47px;background:#fff;border-bottom:1px solid #aeb5ba;display:flex;align-items:center;gap:6px;padding:6px 8px;position:sticky;top:40px;z-index:8;}
    #forward-log-toolbar button{cursor:pointer;}
    .forti-square-button{width:38px;height:34px;border:1px solid #c7ccd0;background:#fff;border-radius:0;font-size:19px;color:#1d2428;display:grid;place-items:center;}
    .forti-square-button:hover,.forti-add-filter:hover{background:#f1f4f5;}
    .forti-log-filter-chips{display:flex;align-items:center;gap:4px;min-width:0;overflow-x:auto;}
    .forti-filter-chip{height:32px;display:flex;align-items:center;gap:6px;background:#c9cccf;border:1px solid #aeb3b7;color:#252a2e;padding:0 8px;font-size:14px;white-space:nowrap;}
    .forti-filter-chip button{border:0;background:transparent;font-size:16px;padding:0;min-width:18px;height:26px;color:#30363a;}
    .forti-add-filter{height:32px;border:1px solid #c7ccd0;background:#fff;padding:0 10px;font-size:14px;white-space:nowrap;}
    #log-toolbar-spacer{flex:1;}
    #log-details-button{height:34px;min-width:82px;border-radius:0;}
    .forti-forward-table-wrap{overflow:auto;height:calc(100vh - 151px);background:#fff;}
    .forti-forward-table{width:100%;min-width:1040px;border-collapse:collapse;table-layout:fixed;font-size:14px;color:#2c3338;}
    .forti-forward-table th{height:43px;background:#f5f5f5;border-right:1px solid #c9cdd0;border-bottom:1px solid #bfc4c7;padding:0 10px;text-align:left;font-weight:500;color:#1d2226;position:sticky;top:0;z-index:3;}
    .forti-forward-table td{height:38px;border-right:1px solid #dedfe0;border-bottom:1px solid #dedfe0;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#fff;}
    .forti-forward-table tbody tr{cursor:pointer;}
    .forti-forward-table tbody tr:hover td{background:#f5f8f6;}
    .forti-forward-table tbody tr.forti-log-selected td{background:#fffca6!important;}
    #forward-policy-heading{width:17%;}#forward-time-heading{width:18%;}#forward-source-heading{width:17%;}#forward-destination-heading{width:31%;}#forward-application-heading{width:14%;}#forward-result-heading{width:18%;}
    .forti-country-flag{margin-right:6px;font-size:15px;}
    .forti-result-ok{color:#388f4c;font-weight:700;margin-right:6px;}
    .forti-result-deny{color:#c23a32;font-weight:700;margin-right:6px;}
    .forti-destination-host{color:#4f565a;}
    .forti-log-footer{height:32px;border-top:1px solid #c8cccf;background:#f7f7f7;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:12px;color:#545b60;}
    .forti-log-detail-grid{display:grid;grid-template-columns:180px minmax(0,1fr);gap:8px 16px;font-size:14px;}
    .forti-log-detail-grid dt{font-weight:700;color:#4b5257;}.forti-log-detail-grid dd{margin:0;word-break:break-word;}
    @media(max-width:760px){#view-logs{margin:-12px}.forti-forward-table-wrap{height:calc(100vh - 148px)}#forward-log-toolbar{top:40px;overflow-x:auto}.forti-log-filter-chips{overflow:visible}.forti-forward-table{font-size:13px}}
  `;
  document.head.append(style);
}

function bindLogs(){
  document.getElementById('nav-log-report')?.addEventListener('click',()=>{
    const sub=document.getElementById('log-report-subnav');
    const parent=document.getElementById('nav-log-report');
    if(!sub||!parent)return;
    sub.hidden=!sub.hidden;
    parent.setAttribute('aria-expanded',String(!sub.hidden));
    parent.querySelector('.nav-chevron').textContent=sub.hidden?'›':'⌄';
  });
  document.getElementById('log-refresh-button')?.addEventListener('click',renderLogs);
  document.getElementById('log-export-button')?.addEventListener('click',exportForwardTrafficCsv);
  document.getElementById('log-add-filter-button')?.addEventListener('click',openForwardLogFilterModal);
  document.getElementById('log-details-button')?.addEventListener('click',()=>{
    const log=findLogById(fortiSelectedLogId); if(log) showForwardLogDetails(log);
  });
}

function renderLogs(){
  const body=document.getElementById('logs-table-body'); if(!body)return;
  body.innerHTML='';
  const logs=[...state.logs].reverse().map(normalizeForwardLog).filter(matchesForwardFilters);
  for(const log of logs){
    const tr=document.createElement('tr');
    tr.dataset.logId=log.id;
    if(log.id===fortiSelectedLogId)tr.classList.add('forti-log-selected');
    const policyName=log.policyName||resolvePolicyName(log.policy);
    const destLabel=destinationLabel(log.destination);
    const flag=countryFlagForIp(log.destination);
    const result=forwardResultText(log);
    tr.innerHTML=`
      <td>${esc(policyName)}</td>
      <td>${esc(formatForwardLogTime(log))}</td>
      <td>${esc(log.source)}</td>
      <td><span class="forti-country-flag">${flag}</span>${esc(log.destination)}${destLabel?` <span class="forti-destination-host">(${esc(destLabel)})</span>`:''}</td>
      <td>${esc(log.application||applicationFromService(log.service))}</td>
      <td>${log.action==='ACCEPT'?'<span class="forti-result-ok">✓</span>':'<span class="forti-result-deny">✕</span>'}${esc(result)}</td>`;
    tr.addEventListener('click',()=>{fortiSelectedLogId=log.id;renderLogs();});
    tr.addEventListener('dblclick',()=>showForwardLogDetails(log));
    body.append(tr);
  }
  renderForwardFilterChips();
  const count=document.getElementById('log-visible-count');if(count)count.textContent=`${logs.length} log${logs.length===1?'':'s'}`;
  const details=document.getElementById('log-details-button');if(details)details.disabled=!findLogById(fortiSelectedLogId);
}

function normalizeForwardLog(log){
  const policy=state.policies.find(p=>String(p.id)===String(log.policy));
  const seed=hashText(`${log.id}|${log.source}|${log.destination}|${log.service}`);
  return {
    ...log,
    id:log.id||uid(),
    timestamp:Number(log.timestamp)||Date.now(),
    policyName:log.policyName||policy?.name||(log.policy==='-'?'Implicit Deny':'INCOMING'),
    incoming:log.incoming||policy?.from||'lan',
    outgoing:log.outgoing||policy?.to||findBestRoute(log.destination)?.interface||'wan',
    nat:typeof log.nat==='boolean'?log.nat:Boolean(policy?.nat),
    application:log.application||applicationFromService(log.service),
    bytesSent:Number(log.bytesSent)||((seed%900)+1)*1024,
    bytesReceived:Number(log.bytesReceived)||(((seed>>>7)%1800)+1)*1024
  };
}

function matchesForwardFilters(log){
  return fortiLogFilters.every(filter=>{
    const needle=String(filter.value).toLowerCase();
    let actual='';
    if(filter.field==='Source')actual=log.source;
    else if(filter.field==='Destination')actual=log.destination;
    else if(filter.field==='Policy Name')actual=log.policyName||resolvePolicyName(log.policy);
    else if(filter.field==='Action')actual=log.action;
    else if(filter.field==='Service')actual=log.service;
    else if(filter.field==='Application')actual=log.application||applicationFromService(log.service);
    return String(actual||'').toLowerCase().includes(needle);
  });
}

function openForwardLogFilterModal(){
  openModal('Add Filter',`
    <div class="form-grid">
      <div class="field"><label for="forward-filter-field">Field</label><select id="forward-filter-field"><option>Source</option><option>Destination</option><option>Policy Name</option><option>Action</option><option>Service</option><option>Application</option></select></div>
      <div class="field"><label for="forward-filter-value">Value</label><input id="forward-filter-value" type="text" placeholder="192.168.1.240"></div>
    </div>`,[
      {label:'Cancel',className:'btn-secondary',action:closeModal},
      {label:'Add Filter',className:'btn-primary',action:()=>{
        const field=document.getElementById('forward-filter-field').value;
        const value=document.getElementById('forward-filter-value').value.trim();
        if(!value){alert('Enter a filter value.');return;}
        fortiLogFilters.push({id:uid(),field,value});closeModal();renderLogs();
      }}
    ]);
}

function renderForwardFilterChips(){
  const wrap=document.getElementById('log-filter-chips');if(!wrap)return;
  wrap.innerHTML='';
  fortiLogFilters.forEach(filter=>{
    const chip=document.createElement('div');chip.className='forti-filter-chip';
    chip.innerHTML=`<strong>✖ ${esc(filter.field)}:</strong> ${esc(filter.value)} <button type="button" aria-label="Remove filter">×</button>`;
    chip.querySelector('button').addEventListener('click',()=>{fortiLogFilters=fortiLogFilters.filter(f=>f.id!==filter.id);renderLogs();});
    wrap.append(chip);
  });
}

function showForwardLogDetails(log){
  log=normalizeForwardLog(log);
  openModal('Forward Traffic Details',`
    <dl class="forti-log-detail-grid">
      <dt>Policy Name</dt><dd>${esc(log.policyName||resolvePolicyName(log.policy))}</dd>
      <dt>Policy ID</dt><dd>${esc(String(log.policy))}</dd>
      <dt>Date/Time</dt><dd>${esc(formatAbsoluteLogTime(log.timestamp))}</dd>
      <dt>Source</dt><dd>${esc(log.source)}</dd>
      <dt>Destination</dt><dd>${esc(log.destination)}${destinationLabel(log.destination)?` (${esc(destinationLabel(log.destination))})`:''}</dd>
      <dt>Incoming Interface</dt><dd>${esc(log.incoming||'-')}</dd>
      <dt>Outgoing Interface</dt><dd>${esc(log.outgoing||'-')}</dd>
      <dt>Service</dt><dd>${esc(log.service||'-')}</dd>
      <dt>Application</dt><dd>${esc(log.application||applicationFromService(log.service))}</dd>
      <dt>Action</dt><dd>${esc(log.action)}</dd>
      <dt>NAT</dt><dd>${log.nat?'Enabled':'Disabled'}</dd>
      <dt>Traffic</dt><dd>${formatBytes(log.bytesSent)} sent / ${formatBytes(log.bytesReceived)} received</dd>
      <dt>Reason</dt><dd>${esc(log.reason||'-')}</dd>
    </dl>`,[{label:'Close',className:'btn-secondary',action:closeModal}]);
}

function runTraffic(){
  const source=document.getElementById('test-source').value.trim();
  const destination=document.getElementById('test-destination').value.trim();
  const incoming=document.getElementById('test-incoming').value;
  const expectedOutgoing=document.getElementById('test-outgoing').value;
  const service=document.getElementById('test-service').value;
  if(!isIPv4(source)||!isIPv4(destination)){alert('Enter valid source and destination IPv4 addresses.');return;}
  const route=findBestRoute(destination);
  const actualOutgoing=route?.interface||expectedOutgoing;
  const result=evaluateTraffic({source,destination,incoming,outgoing:expectedOutgoing,service});
  const policy=state.policies.find(p=>String(p.id)===String(result.policyId));
  const seed=hashText(`${source}|${destination}|${service}|${Date.now()}`);
  state.logs.push({
    id:uid(),timestamp:Date.now(),time:new Date().toLocaleTimeString(),action:result.action,policy:result.policyId,
    policyName:policy?.name||(result.policyId==='-'?'Implicit Deny':'INCOMING'),source,destination,service,
    incoming,outgoing:actualOutgoing,nat:Boolean(policy?.nat),application:applicationFromService(service),
    bytesSent:result.action==='ACCEPT'?((seed%700)+1)*1024:0,
    bytesReceived:result.action==='ACCEPT'?(((seed>>>5)%1400)+1)*1024:0,
    reason:result.reason
  });
  state.logs=state.logs.slice(-500);saveState();closeModal();renderAll();alert(`${result.action}\n${result.reason}`);
}

function exportForwardTrafficCsv(){
  const rows=[...state.logs].reverse().map(normalizeForwardLog).filter(matchesForwardFilters);
  const headers=['Policy Name','Date/Time','Source','Destination','Application Name','Action','Service','NAT','Sent Bytes','Received Bytes','Reason'];
  const csv=[headers,...rows.map(l=>[l.policyName||resolvePolicyName(l.policy),formatAbsoluteLogTime(l.timestamp),l.source,l.destination,l.application,l.action,l.service,l.nat?'Yes':'No',l.bytesSent,l.bytesReceived,l.reason])]
    .map(row=>row.map(csvCell).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='fortigate-forward-traffic.csv';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}

function csvCell(value){const s=String(value??'');return `"${s.replaceAll('"','""')}"`;}
function findLogById(id){return state.logs.find(l=>String(l.id)===String(id))||null;}
function resolvePolicyName(id){const p=state.policies.find(x=>String(x.id)===String(id));return p?.name||(id==='-'?'Implicit Deny':'INCOMING');}
function applicationFromService(service){return ({HTTPS:'HTTPS.BROWSER',HTTP:'HTTP.BROWSER',DNS:'DNS',PING:'ICMP',RDP:'RDP'})[service]||String(service||'Unknown');}
function destinationLabel(ip){return ({'8.8.8.8':'dns.google','1.1.1.1':'one.one.one.one','142.250.75.131':'www.gstatic.com','142.251.150.119':'www.google.com','104.18.39.21':'cloudflare.com','194.36.91.69':'office.pbx1.co.il','95.100.205.42':'www.aliexpress.com'})[ip]||'';}
function countryFlagForIp(ip){if(/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip))return '🏠';const n=isIPv4(ip)?ipToInt(ip):0;return ['🇺🇸','🇮🇱','🇨🇦','🇧🇪','🇫🇷','🇺🇦'][n%6];}
function forwardResultText(log){if(log.action!=='ACCEPT')return 'Denied';return `${formatBytes(log.bytesSent)} / ${formatBytes(log.bytesReceived)}`;}
function formatBytes(n){n=Number(n)||0;if(n>=1024*1024)return `${(n/(1024*1024)).toFixed(2)} MB`;if(n>=1024)return `${(n/1024).toFixed(2)} kB`;return `${n} B`;}
function formatAbsoluteLogTime(ts){const d=new Date(Number(ts)||Date.now());return d.toLocaleString('sv-SE').replace('T',' ');}
function formatForwardLogTime(log){
  if(log.timestamp){const diff=Math.max(0,Date.now()-Number(log.timestamp));if(diff<60000){const s=Math.max(0,Math.floor(diff/1000));return s<2?'now':`${s} seconds ago`;}if(diff<120000)return 'Minute ago';if(diff<3600000)return `${Math.floor(diff/60000)} minutes ago`;}
  return log.time||formatAbsoluteLogTime(log.timestamp);
}

prepareFortiLogReport();
