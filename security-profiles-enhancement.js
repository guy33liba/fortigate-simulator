/* FortiOS 7.0-style Security Profiles simulator. */
const spTypes=['antivirus','webFilter','dnsFilter','applicationControl','ips','sslInspection'];
const spSelected={antivirus:null,webFilter:null,dnsFilter:null,applicationControl:null,ips:null,sslInspection:null};
let spTrafficContext=null;
let spLastDecision=null;

const spMeta={
  antivirus:{title:'AntiVirus',view:'security-antivirus',policyFlag:'antivirus',profileField:'antivirusProfile'},
  webFilter:{title:'Web Filter',view:'security-web-filter',policyFlag:'webFilter',profileField:'webFilterProfile'},
  dnsFilter:{title:'DNS Filter',view:'security-dns-filter',policyFlag:'dnsFilter',profileField:'dnsFilterProfile'},
  applicationControl:{title:'Application Control',view:'security-application-control',policyFlag:'applicationControl',profileField:'applicationControlProfile'},
  ips:{title:'Intrusion Prevention',view:'security-ips',policyFlag:'ips',profileField:'ipsProfile'},
  sslInspection:{title:'SSL/SSH Inspection',view:'security-ssl',policyFlag:null,profileField:'sslInspection'}
};

function spInitState(){
  state.securityProfiles ||= {};
  state.securityProfiles.antivirus ||= [
    {id:'av-default',name:'default',builtin:true,featureSet:'Flow-based',action:'Block',protocols:['HTTP','FTP','SMTP','IMAP','POP3'],scanArchives:true}
  ];
  state.securityProfiles.webFilter ||= [
    {id:'wf-default',name:'default',builtin:true,featureSet:'Flow-based',blockedDomains:['malicious.test','phishing.test'],blockedCategories:['Malicious Websites','Phishing'],monitorCategories:['Social Networking','Streaming Media']}
  ];
  state.securityProfiles.dnsFilter ||= [
    {id:'df-default',name:'default',builtin:true,blockedDomains:['malicious.test','phishing.test','botnet.test'],botnetBlock:true}
  ];
  state.securityProfiles.applicationControl ||= [
    {id:'app-default',name:'default',builtin:true,blockedApps:['BitTorrent','Tor'],monitorApps:['YouTube','Facebook','WhatsApp']}
  ];
  state.securityProfiles.ips ||= [
    {id:'ips-default',name:'default',builtin:true,blockSeverities:['Critical','High'],monitorSeverities:['Medium']}
  ];
  state.securityProfiles.sslInspection ||= [
    {id:'ssl-none',name:'no-inspection',builtin:true,mode:'No Inspection'},
    {id:'ssl-cert',name:'certificate-inspection',builtin:true,mode:'Certificate Inspection'},
    {id:'ssl-deep',name:'deep-inspection',builtin:true,mode:'Deep Inspection'}
  ];
  state.policies.forEach(p=>{
    p.antivirusProfile ||= 'default';
    p.webFilterProfile ||= 'default';
    p.dnsFilterProfile ||= 'default';
    p.applicationControlProfile ||= 'default';
    p.ips = Boolean(p.ips);
    p.ipsProfile ||= 'default';
    p.sslInspection ||= 'no-inspection';
  });
  saveState();
}

function spPrepareNavigation(){
  const old=$('nav-security');if(!old||$('security-profiles-group'))return;
  const group=document.createElement('div');
  group.id='security-profiles-group';group.className='nav-group';
  group.innerHTML=`<button id="nav-security-profiles" class="nav-item nav-parent" type="button" aria-expanded="false" aria-controls="security-profiles-subnav"><span class="nav-icon">▰</span><span>Security Profiles</span><span class="nav-chevron">›</span></button><div id="security-profiles-subnav" class="subnav" hidden><button id="nav-security-antivirus" class="subnav-item" data-view="security-antivirus" type="button">AntiVirus</button><button id="nav-security-web-filter" class="subnav-item" data-view="security-web-filter" type="button">Web Filter</button><button id="nav-security-dns-filter" class="subnav-item" data-view="security-dns-filter" type="button">DNS Filter</button><button id="nav-security-app-control" class="subnav-item" data-view="security-application-control" type="button">Application Control</button><button id="nav-security-ips" class="subnav-item" data-view="security-ips" type="button">Intrusion Prevention</button><button id="nav-security-ssl" class="subnav-item" data-view="security-ssl" type="button">SSL/SSH Inspection</button></div>`;
  old.replaceWith(group);
}

function spPrepareViews(){
  const main=$('main-content');if(!main)return;
  spTypes.forEach(type=>{
    const meta=spMeta[type];if($(`view-${meta.view}`))return;
    main.insertAdjacentHTML('beforeend',`<section id="view-${meta.view}" class="app-view"><div id="${meta.view}-header" class="page-heading-row"><h1 id="${meta.view}-title">${meta.title}</h1></div><div id="${meta.view}-toolbar" class="toolbar"><button id="${meta.view}-create" class="btn-primary">＋ Create New</button><button id="${meta.view}-edit" class="btn-secondary" disabled>✎ Edit</button><button id="${meta.view}-delete" class="btn-secondary" disabled>▱ Delete</button><button id="${meta.view}-clone" class="btn-secondary" disabled>⧉ Clone</button></div><div id="${meta.view}-wrap" class="table-wrap full-table-wrap"><table id="${meta.view}-table" class="data-table"><thead><tr><th>Name</th><th>Feature / Mode</th><th>Action / Settings</th><th>Ref.</th></tr></thead><tbody id="${meta.view}-body"></tbody></table></div><div id="${meta.view}-help" class="muted">Security profiles inspect traffic only when they are enabled on a matching firewall policy.</div></section>`);
  });
}

function spProfiles(type){return state.securityProfiles?.[type]||[];}
function spFind(type,name){return spProfiles(type).find(p=>p.name===name)||null;}
function spSelectedProfile(type){return spProfiles(type).find(p=>p.id===spSelected[type])||null;}
function spCsv(value){return String(value||'').split(',').map(x=>x.trim()).filter(Boolean);}
function spCsvText(value){return Array.isArray(value)?value.join(', '):'';}

function spRefCount(type,name){
  const meta=spMeta[type];
  if(type==='sslInspection')return state.policies.filter(p=>(p.sslInspection||'no-inspection')===name).length;
  return state.policies.filter(p=>Boolean(p[meta.policyFlag])&&(p[meta.profileField]||'default')===name).length;
}

function spSummary(type,p){
  if(type==='antivirus')return `${p.action||'Block'} · ${(p.protocols||[]).join(', ')||'No protocols'}${p.scanArchives?' · Archives':''}`;
  if(type==='webFilter')return `Block domains ${(p.blockedDomains||[]).length} · categories ${(p.blockedCategories||[]).length}`;
  if(type==='dnsFilter')return `Block domains ${(p.blockedDomains||[]).length}${p.botnetBlock?' · Botnet block':''}`;
  if(type==='applicationControl')return `Block ${(p.blockedApps||[]).join(', ')||'None'} · Monitor ${(p.monitorApps||[]).join(', ')||'None'}`;
  if(type==='ips')return `Block ${(p.blockSeverities||[]).join(', ')||'None'} · Monitor ${(p.monitorSeverities||[]).join(', ')||'None'}`;
  return p.mode||'No Inspection';
}
function spFeature(type,p){
  if(['antivirus','webFilter'].includes(type))return p.featureSet||'Flow-based';
  if(type==='sslInspection')return p.mode||'No Inspection';
  return 'Flow / Proxy';
}

function spRender(type){
  const meta=spMeta[type],body=$(`${meta.view}-body`);if(!body)return;
  body.innerHTML='';
  spProfiles(type).forEach(p=>{
    const tr=document.createElement('tr');if(p.id===spSelected[type])tr.classList.add('selected');
    tr.innerHTML=`<td><strong>${esc(p.name)}</strong>${p.builtin?' <span class="status-chip">Built-in</span>':''}</td><td>${esc(spFeature(type,p))}</td><td>${esc(spSummary(type,p))}</td><td>${spRefCount(type,p.name)}</td>`;
    tr.addEventListener('click',()=>{spSelected[type]=p.id;spRender(type);});
    tr.addEventListener('dblclick',()=>{if(!p.builtin)spOpenEditor(type,p);});
    body.append(tr);
  });
  spUpdateButtons(type);
}
function spRenderAll(){spTypes.forEach(spRender);}
function spUpdateButtons(type){
  const meta=spMeta[type],p=spSelectedProfile(type);
  if($(`${meta.view}-edit`))$(`${meta.view}-edit`).disabled=!p||p.builtin;
  if($(`${meta.view}-delete`))$(`${meta.view}-delete`).disabled=!p||p.builtin||spRefCount(type,p.name)>0;
  if($(`${meta.view}-clone`))$(`${meta.view}-clone`).disabled=!p;
}

function spEditorBody(type,p){
  const name=`<div class="field"><label for="sp-name">Name</label><input id="sp-name" value="${esc(p?.name||'custom-profile')}"></div>`;
  if(type==='antivirus')return `<div class="form-grid">${name}<div class="field"><label for="sp-feature">Feature Set</label><select id="sp-feature"><option>Flow-based</option><option>Proxy-based</option></select></div><div class="field"><label for="sp-action">Malware Action</label><select id="sp-action"><option>Block</option><option>Monitor</option></select></div><div class="field"><label for="sp-protocols">Protocols</label><input id="sp-protocols" value="${esc(spCsvText(p?.protocols||['HTTP','FTP','SMTP']))}"></div><div class="field full"><label><input id="sp-archives" type="checkbox" ${p?.scanArchives!==false?'checked':''}> Scan archives</label></div></div>`;
  if(type==='webFilter')return `<div class="form-grid">${name}<div class="field"><label for="sp-feature">Feature Set</label><select id="sp-feature"><option>Flow-based</option><option>Proxy-based</option></select></div><div class="field full"><label for="sp-block-domains">Blocked Domains</label><input id="sp-block-domains" value="${esc(spCsvText(p?.blockedDomains||[]))}" placeholder="malicious.test, phishing.test"></div><div class="field full"><label for="sp-block-categories">Blocked Categories</label><input id="sp-block-categories" value="${esc(spCsvText(p?.blockedCategories||[]))}" placeholder="Malicious Websites, Phishing"></div><div class="field full"><label for="sp-monitor-categories">Monitored Categories</label><input id="sp-monitor-categories" value="${esc(spCsvText(p?.monitorCategories||[]))}" placeholder="Social Networking, Streaming Media"></div></div>`;
  if(type==='dnsFilter')return `<div class="form-grid">${name}<div class="field full"><label for="sp-block-domains">Blocked Domains</label><input id="sp-block-domains" value="${esc(spCsvText(p?.blockedDomains||[]))}" placeholder="botnet.test, phishing.test"></div><div class="field full"><label><input id="sp-botnet" type="checkbox" ${p?.botnetBlock!==false?'checked':''}> Block known botnet / malicious domains</label></div></div>`;
  if(type==='applicationControl')return `<div class="form-grid">${name}<div class="field full"><label for="sp-block-apps">Blocked Applications</label><input id="sp-block-apps" value="${esc(spCsvText(p?.blockedApps||[]))}" placeholder="BitTorrent, Tor"></div><div class="field full"><label for="sp-monitor-apps">Monitored Applications</label><input id="sp-monitor-apps" value="${esc(spCsvText(p?.monitorApps||[]))}" placeholder="YouTube, Facebook"></div></div>`;
  if(type==='ips')return `<div class="form-grid">${name}<div class="field full"><label for="sp-block-severity">Block Severities</label><input id="sp-block-severity" value="${esc(spCsvText(p?.blockSeverities||['Critical','High']))}" placeholder="Critical, High"></div><div class="field full"><label for="sp-monitor-severity">Monitor Severities</label><input id="sp-monitor-severity" value="${esc(spCsvText(p?.monitorSeverities||['Medium']))}" placeholder="Medium"></div></div>`;
  return `<div class="form-grid">${name}<div class="field"><label for="sp-ssl-mode">Inspection Mode</label><select id="sp-ssl-mode"><option>No Inspection</option><option>Certificate Inspection</option><option>Deep Inspection</option></select></div><div class="field full"><div class="muted">Deep Inspection decrypts simulated HTTPS payloads so content security profiles can inspect them.</div></div></div>`;
}

function spOpenEditor(type,p=null){
  const editingId=p?.id||null;
  openModal(p?`Edit ${spMeta[type].title} Profile`:`Create ${spMeta[type].title} Profile`,spEditorBody(type,p),[
    {label:'Cancel',className:'btn-secondary',action:closeModal},
    {label:p?'OK':'Create',className:'btn-primary',action:()=>spSaveProfile(type,editingId)}
  ]);
  if($('sp-feature'))$('sp-feature').value=p?.featureSet||'Flow-based';
  if($('sp-action'))$('sp-action').value=p?.action||'Block';
  if($('sp-ssl-mode'))$('sp-ssl-mode').value=p?.mode||'Certificate Inspection';
}

function spSaveProfile(type,id){
  const old=spProfiles(type).find(x=>x.id===id)||null;
  const name=$('sp-name')?.value.trim()||'';
  if(!name){alert('Profile name is required.');return;}
  if(spProfiles(type).some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase())){alert('Profile name must be unique.');return;}
  let data={id:id||uid(),name,builtin:false};
  if(type==='antivirus')data={...data,featureSet:$('sp-feature').value,action:$('sp-action').value,protocols:spCsv($('sp-protocols').value),scanArchives:$('sp-archives').checked};
  else if(type==='webFilter')data={...data,featureSet:$('sp-feature').value,blockedDomains:spCsv($('sp-block-domains').value),blockedCategories:spCsv($('sp-block-categories').value),monitorCategories:spCsv($('sp-monitor-categories').value)};
  else if(type==='dnsFilter')data={...data,blockedDomains:spCsv($('sp-block-domains').value),botnetBlock:$('sp-botnet').checked};
  else if(type==='applicationControl')data={...data,blockedApps:spCsv($('sp-block-apps').value),monitorApps:spCsv($('sp-monitor-apps').value)};
  else if(type==='ips')data={...data,blockSeverities:spCsv($('sp-block-severity').value),monitorSeverities:spCsv($('sp-monitor-severity').value)};
  else data={...data,mode:$('sp-ssl-mode').value};
  const list=spProfiles(type),idx=list.findIndex(x=>x.id===id);
  if(idx>=0)list[idx]=data;else list.push(data);
  spSelected[type]=data.id;saveState();closeModal();spRender(type);renderPolicies();
}

function spDelete(type){
  const p=spSelectedProfile(type);if(!p||p.builtin)return;
  const refs=spRefCount(type,p.name);if(refs){alert(`Profile is referenced by ${refs} firewall policy/policies.`);return;}
  if(confirm(`Delete profile "${p.name}"?`)){state.securityProfiles[type]=spProfiles(type).filter(x=>x.id!==p.id);spSelected[type]=null;saveState();spRender(type);}
}
function spClone(type){
  const p=spSelectedProfile(type);if(!p)return;
  const clone=structuredClone(p);clone.id=uid();clone.builtin=false;let base=`${p.name}_copy`,n=2;clone.name=base;while(spProfiles(type).some(x=>x.name===clone.name))clone.name=`${base}_${n++}`;
  state.securityProfiles[type].push(clone);spSelected[type]=clone.id;saveState();spRender(type);
}

function spBind(){
  spTypes.forEach(type=>{
    const meta=spMeta[type];
    $(`${meta.view}-create`)?.addEventListener('click',()=>spOpenEditor(type));
    $(`${meta.view}-edit`)?.addEventListener('click',()=>{const p=spSelectedProfile(type);if(p&&!p.builtin)spOpenEditor(type,p);});
    $(`${meta.view}-delete`)?.addEventListener('click',()=>spDelete(type));
    $(`${meta.view}-clone`)?.addEventListener('click',()=>spClone(type));
  });
}

function spOptionList(type,selected){return spProfiles(type).map(p=>`<option value="${esc(p.name)}" ${p.name===selected?'selected':''}>${esc(p.name)}</option>`).join('');}
function spSyncPolicyProfileVisibility(){
  const pairs=[['po-av','sp-policy-av'],['po-web','sp-policy-web'],['po-dns','sp-policy-dns'],['po-app','sp-policy-app'],['po-ips','sp-policy-ips']];
  pairs.forEach(([check,field])=>{if($(field))$(field).hidden=!$(check)?.checked;});
}

if(typeof poPolicyModal==='function'){
  const spCorePolicyModal=poPolicyModal;
  poPolicyModal=function(policy=null){
    spCorePolicyModal(policy);
    const form=$('po-name')?.closest('.form-grid');if(!form||$('sp-policy-profile-block'))return;
    const checkRow=$('po-av')?.closest('.check-row');
    if(checkRow&&!$('po-ips')){
      const label=document.createElement('label');label.id='po-ips-label';label.innerHTML=`<input id="po-ips" type="checkbox" ${policy?.ips?'checked':''}> IPS`;checkRow.append(label);
    }
    const block=document.createElement('div');block.id='sp-policy-profile-block';block.className='field full';
    block.innerHTML=`<label id="sp-policy-profile-title">Security Profile Selection</label><div id="sp-policy-profile-grid" class="form-grid"><div id="sp-policy-av" class="field"><label for="sp-policy-av-select">AntiVirus Profile</label><select id="sp-policy-av-select">${spOptionList('antivirus',policy?.antivirusProfile||'default')}</select></div><div id="sp-policy-web" class="field"><label for="sp-policy-web-select">Web Filter Profile</label><select id="sp-policy-web-select">${spOptionList('webFilter',policy?.webFilterProfile||'default')}</select></div><div id="sp-policy-dns" class="field"><label for="sp-policy-dns-select">DNS Filter Profile</label><select id="sp-policy-dns-select">${spOptionList('dnsFilter',policy?.dnsFilterProfile||'default')}</select></div><div id="sp-policy-app" class="field"><label for="sp-policy-app-select">Application Control Profile</label><select id="sp-policy-app-select">${spOptionList('applicationControl',policy?.applicationControlProfile||'default')}</select></div><div id="sp-policy-ips" class="field"><label for="sp-policy-ips-select">IPS Sensor</label><select id="sp-policy-ips-select">${spOptionList('ips',policy?.ipsProfile||'default')}</select></div></div>`;
    form.append(block);
    ['po-av','po-web','po-dns','po-app','po-ips'].forEach(id=>$(id)?.addEventListener('change',spSyncPolicyProfileVisibility));
    spSyncPolicyProfileVisibility();
  };
}

if(typeof poSavePolicy==='function'){
  const spCoreSavePolicy=poSavePolicy;
  poSavePolicy=function(){
    const snapshot={
      ips:Boolean($('po-ips')?.checked),
      antivirusProfile:$('sp-policy-av-select')?.value||'default',
      webFilterProfile:$('sp-policy-web-select')?.value||'default',
      dnsFilterProfile:$('sp-policy-dns-select')?.value||'default',
      applicationControlProfile:$('sp-policy-app-select')?.value||'default',
      ipsProfile:$('sp-policy-ips-select')?.value||'default'
    };
    spCoreSavePolicy();
    if($('po-name'))return;
    const p=state.policies.find(x=>x.uid===selectedPolicyUid);if(!p)return;
    Object.assign(p,snapshot);saveState();renderAll();
  };
}

if(typeof renderPolicies==='function'){
  const spCoreRenderPolicies=renderPolicies;
  renderPolicies=function(){
    spCoreRenderPolicies();
    const rows=[...($('policies-table-body')?.querySelectorAll('tr')||[])];
    state.policies.forEach((p,i)=>{
      const cell=rows[i]?.children?.[11];if(!cell)return;
      const active=[];
      if(p.antivirus)active.push(`AV:${p.antivirusProfile||'default'}`);
      if(p.webFilter)active.push(`Web:${p.webFilterProfile||'default'}`);
      if(p.dnsFilter)active.push(`DNS:${p.dnsFilterProfile||'default'}`);
      if(p.applicationControl)active.push(`App:${p.applicationControlProfile||'default'}`);
      if(p.ips)active.push(`IPS:${p.ipsProfile||'default'}`);
      if(p.fileFilter)active.push('File');
      cell.textContent=active.join(', ')||'—';
      cell.title=active.join(' · ');
    });
  };
}

function spHostDomain(value){return String(value||'').trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0].split(':')[0];}
function spDomainMatch(domain,rule){domain=spHostDomain(domain);rule=spHostDomain(rule);return Boolean(domain&&rule&&(domain===rule||domain.endsWith(`.${rule}`)));}
function spWebCategory(domain){
  domain=spHostDomain(domain);
  if(!domain)return 'Unrated';
  if(domain.includes('malicious'))return 'Malicious Websites';
  if(domain.includes('phishing'))return 'Phishing';
  if(domain.includes('facebook')||domain.includes('instagram')||domain.includes('tiktok'))return 'Social Networking';
  if(domain.includes('youtube')||domain.includes('netflix'))return 'Streaming Media';
  return 'General Interest - Business';
}
function spSeverityFromThreat(threat){const s=String(threat||'');return ['Critical','High','Medium','Low'].find(x=>s.startsWith(x))||'None';}

const spCoreEvaluateTraffic=evaluateTraffic;
evaluateTraffic=function(args){
  const result=spCoreEvaluateTraffic(args);spLastDecision=null;
  if(result.action!=='ACCEPT')return result;
  const policy=state.policies.find(p=>String(p.id)===String(result.policyId));if(!policy)return result;
  const ctx=spTrafficContext||{};const host=spHostDomain(ctx.host),app=ctx.application||applicationFromService(args.service),threat=ctx.threat||'None',fileStatus=ctx.fileStatus||'None';
  const applied=[],monitored=[];
  const deny=(profileType,profileName,why)=>{spLastDecision={profileType,profileName,action:'Block',host,application:app,threat,fileStatus};return{...result,action:'DENY',reason:`${result.reason}; ${spMeta[profileType].title} (${profileName}) blocked: ${why}`};};

  if(policy.dnsFilter&&String(args.service).toUpperCase()==='DNS'){
    const name=policy.dnsFilterProfile||'default',profile=spFind('dnsFilter',name);if(profile){applied.push(`DNS:${name}`);if(host&&(profile.blockedDomains||[]).some(d=>spDomainMatch(host,d)))return deny('dnsFilter',name,`DNS query ${host}`);if(host&&profile.botnetBlock&&host.includes('botnet'))return deny('dnsFilter',name,`botnet domain ${host}`);}
  }
  if(policy.webFilter&&host){
    const name=policy.webFilterProfile||'default',profile=spFind('webFilter',name),category=spWebCategory(host);if(profile){applied.push(`Web:${name}`);if((profile.blockedDomains||[]).some(d=>spDomainMatch(host,d)))return deny('webFilter',name,`domain ${host}`);if((profile.blockedCategories||[]).includes(category))return deny('webFilter',name,`category ${category} for ${host}`);if((profile.monitorCategories||[]).includes(category))monitored.push(`Web Filter monitored ${category}`);}
  }
  if(policy.applicationControl&&app){
    const name=policy.applicationControlProfile||'default',profile=spFind('applicationControl',name);if(profile){applied.push(`App:${name}`);if((profile.blockedApps||[]).some(x=>x.toLowerCase()===String(app).toLowerCase()))return deny('applicationControl',name,`application ${app}`);if((profile.monitorApps||[]).some(x=>x.toLowerCase()===String(app).toLowerCase()))monitored.push(`Application Control monitored ${app}`);}
  }
  if(policy.ips&&threat!=='None'){
    const name=policy.ipsProfile||'default',profile=spFind('ips',name),severity=spSeverityFromThreat(threat);if(profile){applied.push(`IPS:${name}`);if((profile.blockSeverities||[]).includes(severity))return deny('ips',name,`${threat}`);if((profile.monitorSeverities||[]).includes(severity))monitored.push(`IPS monitored ${threat}`);}
  }
  if(policy.antivirus&&fileStatus==='Malware'){
    const name=policy.antivirusProfile||'default',profile=spFind('antivirus',name);if(profile){applied.push(`AV:${name}`);const encrypted=String(args.service).toUpperCase()==='HTTPS';const deep=(policy.sslInspection||'no-inspection')==='deep-inspection';if(encrypted&&!deep)monitored.push(`AntiVirus cannot inspect encrypted payload with ${policy.sslInspection||'no-inspection'}`);else if((profile.action||'Block')==='Block')return deny('antivirus',name,'malware file');else monitored.push('AntiVirus monitored malware file');}
  }else if(policy.antivirus){applied.push(`AV:${policy.antivirusProfile||'default'}`);}

  if(String(args.service).toUpperCase()==='HTTPS')applied.push(`SSL:${policy.sslInspection||'no-inspection'}`);
  if(applied.length||monitored.length){result.reason+=`; security profiles ${applied.join(', ')||'none'}${monitored.length?`; ${monitored.join('; ')}`:''}`;spLastDecision={profileType:'multiple',profileName:applied.join(', '),action:'Allow/Monitor',host,application:app,threat,fileStatus};}
  return result;
};

const spCoreOpenTrafficModal=openTrafficModal;
openTrafficModal=function(){
  spCoreOpenTrafficModal();
  const form=$('test-source')?.closest('.form-grid');if(!form||$('sp-test-host'))return;
  form.insertAdjacentHTML('beforeend',`<div class="field"><label for="sp-test-host">URL / DNS Host</label><input id="sp-test-host" type="text" placeholder="example.com"></div><div class="field"><label for="sp-test-application">Application</label><select id="sp-test-application"><option value="">Auto from Service</option><option>HTTPS.BROWSER</option><option>HTTP.BROWSER</option><option>YouTube</option><option>Facebook</option><option>WhatsApp</option><option>BitTorrent</option><option>Tor</option><option>RDP</option><option>DNS</option></select></div><div class="field"><label for="sp-test-threat">IPS Test Signature</label><select id="sp-test-threat"><option>None</option><option>Critical - Remote Code Execution</option><option>High - Exploit Attempt</option><option>Medium - Protocol Anomaly</option><option>Low - Reconnaissance</option></select></div><div class="field"><label for="sp-test-file">File Scan</label><select id="sp-test-file"><option>None</option><option>Clean</option><option>Malware</option></select></div><div class="field full"><div class="muted">Try malicious.test with Web Filter, BitTorrent with Application Control, a High/Critical IPS signature, or Malware over HTTPS with deep-inspection.</div></div>`);
};

const spCoreRunTraffic=runTraffic;
runTraffic=function(){
  spTrafficContext={host:$('sp-test-host')?.value||'',application:$('sp-test-application')?.value||'',threat:$('sp-test-threat')?.value||'None',fileStatus:$('sp-test-file')?.value||'None'};
  const before=state.logs.length;spLastDecision=null;
  spCoreRunTraffic();
  if(state.logs.length>before){const log=state.logs[state.logs.length-1];if(spLastDecision){log.securityProfile=spLastDecision.profileName;log.securityAction=spLastDecision.action;log.urlHost=spLastDecision.host;log.detectedApplication=spLastDecision.application;log.threat=spLastDecision.threat;log.fileStatus=spLastDecision.fileStatus;saveState();renderAll();}}
  spTrafficContext=null;spLastDecision=null;
};

if(typeof showForwardLogDetails==='function'){
  const spCoreShowLogDetails=showForwardLogDetails;
  showForwardLogDetails=function(log){
    spCoreShowLogDetails(log);const grid=document.querySelector('#modal-body .forti-log-detail-grid');if(!grid||!log)return;
    const extra=[['Security Profile',log.securityProfile],['Security Action',log.securityAction],['URL / Host',log.urlHost],['Detected Application',log.detectedApplication],['Threat',log.threat],['File Scan',log.fileStatus]].filter(x=>x[1]);
    extra.forEach(([k,v])=>{const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;grid.append(dt,dd);});
  };
}

const spCoreShowView=showView;
showView=function(name){
  spCoreShowView(name);
  const type=spTypes.find(t=>spMeta[t].view===name);
  if(type){$('nav-security-profiles')?.classList.add('active');spRender(type);}
};

const spCoreRenderAll=renderAll;
renderAll=function(){spCoreRenderAll();spRenderAll();};

const spCoreRunCli=runCli;
runCli=function(command){
  const text=String(command||'').trim(),lower=text.toLowerCase();
  const map={
    'show antivirus profile':'antivirus',
    'show webfilter profile':'webFilter',
    'show dnsfilter profile':'dnsFilter',
    'show application list':'applicationControl',
    'show ips sensor':'ips',
    'show firewall ssl-ssh-profile':'sslInspection'
  };
  if(map[lower]){const type=map[lower];cli(`FG-SIM-01 # ${text}`);cli(spProfiles(type).map(p=>`${p.name}${p.builtin?' (built-in)':''}: ${spSummary(type,p)} refs=${spRefCount(type,p.name)}`).join('\n')||'No profiles.');return;}
  spCoreRunCli(text);
};

spInitState();
spPrepareNavigation();
spPrepareViews();
document.addEventListener('DOMContentLoaded',spBind);
