/* FortiOS 7 Policy & Objects: state, navigation and views. */
const poSel={addresses:null,services:null,schedules:null,vips:null,ipPools:null,protocolOptions:null,trafficShapers:null};
let poEditingPolicy=null;

function poInitState(){
  state.addresses ||= [{id:'a-all',name:'all',type:'Subnet',value:'0.0.0.0/0',interface:'any',builtin:true},{id:'a-lan',name:'LAN_Subnet',type:'Subnet',value:'192.168.1.0/24',interface:'lan'},{id:'a-dmz',name:'DMZ_Subnet',type:'Subnet',value:'10.10.10.0/24',interface:'dmz'}];
  state.services ||= [{id:'s-all',name:'ALL',protocol:'IP',port:'ALL',builtin:true},{id:'s-ping',name:'PING',protocol:'ICMP',port:'',builtin:true},{id:'s-http',name:'HTTP',protocol:'TCP',port:'80',builtin:true},{id:'s-https',name:'HTTPS',protocol:'TCP',port:'443',builtin:true},{id:'s-dns',name:'DNS',protocol:'TCP/UDP',port:'53',builtin:true},{id:'s-rdp',name:'RDP',protocol:'TCP',port:'3389',builtin:true}];
  state.schedules ||= [{id:'sch-always',name:'always',type:'Recurring',days:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],start:'00:00',end:'23:59',builtin:true}];
  state.vips ||= []; state.ipPools ||= [];
  state.protocolOptions ||= [{id:'proto-default',name:'default',tcpHalfClose:120,tcpTimeWait:1,builtin:true}];
  state.trafficShapers ||= [];
  state.internetServices ||= [{id:65539,name:'Google-Gmail',category:'Web / Email',protocol:'TCP/443'},{id:327681,name:'Microsoft-Office365',category:'Collaboration',protocol:'TCP/443'},{id:393217,name:'WhatsApp',category:'Messaging',protocol:'TCP/443'},{id:524289,name:'Cloudflare-CDN',category:'CDN',protocol:'TCP/443'}];
  state.policies.forEach(p=>Object.assign(p,{schedule:p.schedule||'always',inspectionMode:p.inspectionMode||'Flow-based',natMode:p.natMode||'Outgoing Interface Address',ipPool:p.ipPool||'',protocolOptions:p.protocolOptions||'default',sslInspection:p.sslInspection||'no-inspection',logTraffic:p.logTraffic||'All Sessions',comments:p.comments||'',trafficShaper:p.trafficShaper||''},{antivirus:!!p.antivirus,webFilter:!!p.webFilter,dnsFilter:!!p.dnsFilter,applicationControl:!!p.applicationControl,fileFilter:!!p.fileFilter}));
  saveState();
}

function poNav(){
  const old=$('nav-policy');if(!old||$('policy-objects-group'))return;
  const g=document.createElement('div');g.id='policy-objects-group';g.className='nav-group';
  g.innerHTML=`<button id="nav-policy-objects" class="nav-item nav-parent" type="button" aria-expanded="false"><span class="nav-icon">▣</span><span>Policy & Objects</span><span class="nav-chevron">›</span></button><div id="policy-objects-subnav" class="subnav" hidden><button id="nav-firewall-policy" class="subnav-item" data-view="policies">Firewall Policy</button><button id="nav-addresses" class="subnav-item" data-view="addresses">Addresses</button><button id="nav-isdb" class="subnav-item" data-view="internet-services">Internet Service Database</button><button id="nav-services" class="subnav-item" data-view="services">Services</button><button id="nav-schedules" class="subnav-item" data-view="schedules">Schedules</button><button id="nav-vips" class="subnav-item" data-view="vips">Virtual IPs</button><button id="nav-ip-pools" class="subnav-item" data-view="ip-pools">IP Pools</button><button id="nav-protocol-options" class="subnav-item" data-view="protocol-options">Protocol Options</button><button id="nav-traffic-shaping" class="subnav-item" data-view="traffic-shaping">Traffic Shaping</button></div>`;
  old.replaceWith(g);
}

const poDefs={
  addresses:{title:'Addresses',headers:['Name','Type','Value','Interface','Ref.'],collection:()=>state.addresses,row:x=>[x.name,x.type,x.value,x.interface||'any',poRefs('address',x.name)]},
  services:{title:'Services',headers:['Name','Protocol','Destination Port','Ref.'],collection:()=>state.services,row:x=>[x.name,x.protocol,x.port||'—',poRefs('service',x.name)]},
  schedules:{title:'Schedules',headers:['Name','Type','Time / Days','Ref.'],collection:()=>state.schedules,row:x=>[x.name,x.type,x.type==='Recurring'?`${(x.days||[]).join(', ')} ${x.start||''}-${x.end||''}`:`${x.startDate||''} → ${x.endDate||''}`,poRefs('schedule',x.name)]},
  vips:{title:'Virtual IPs',headers:['Name','Interface','External IP','Mapped IP','Port Forwarding','Ref.'],collection:()=>state.vips,row:x=>[x.name,x.interface,x.externalIp,x.mappedIp,x.portForward?`${x.protocol} ${x.externalPort}→${x.mappedPort}`:'No',poRefs('vip',x.name)]},
  'ip-pools':{title:'IP Pools',headers:['Name','Type','Start IP','End IP','Ref.'],collection:()=>state.ipPools,row:x=>[x.name,x.type,x.startIp,x.endIp,poRefs('ipPool',x.name)]},
  'protocol-options':{title:'Protocol Options',headers:['Name','TCP Half Close','TCP Time Wait','Ref.'],collection:()=>state.protocolOptions,row:x=>[x.name,`${x.tcpHalfClose}s`,`${x.tcpTimeWait}s`,poRefs('protocolOptions',x.name)]},
  'traffic-shaping':{title:'Traffic Shaping',headers:['Name','Type','Maximum','Guaranteed','Priority','Ref.'],collection:()=>state.trafficShapers,row:x=>[x.name,x.type,`${x.maximumBandwidth} kbps`,`${x.guaranteedBandwidth} kbps`,x.priority,poRefs('trafficShaper',x.name)]}
};

function poViews(){
  const main=$('main-content');if(!main||$('view-addresses'))return;
  Object.entries(poDefs).forEach(([k,d])=>main.insertAdjacentHTML('beforeend',`<section id="view-${k}" class="app-view"><div id="${k}-header" class="page-heading-row"><h1 id="${k}-title">${d.title}</h1></div><div id="${k}-toolbar" class="toolbar"><button id="${k}-create" class="btn-primary">＋ Create New</button><button id="${k}-edit" class="btn-secondary" disabled>✎ Edit</button><button id="${k}-delete" class="btn-secondary" disabled>▱ Delete</button></div><div id="${k}-table-wrap" class="table-wrap full-table-wrap"><table id="${k}-table" class="data-table"><thead><tr>${d.headers.map((h,i)=>`<th id="${k}-h${i}">${h}</th>`).join('')}</tr></thead><tbody id="${k}-body"></tbody></table></div></section>`));
  main.insertAdjacentHTML('beforeend',`<section id="view-internet-services" class="app-view"><div id="isdb-header" class="page-heading-row"><h1 id="isdb-title">Internet Service Database</h1></div><div id="isdb-toolbar" class="toolbar"><input id="isdb-search" class="search-input" type="search" placeholder="Search"></div><div id="isdb-wrap" class="table-wrap full-table-wrap"><table id="isdb-table" class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Protocol</th><th>Status</th></tr></thead><tbody id="internet-services-body"></tbody></table></div></section>`);
}

function poPolicyView(){
  const v=$('view-policies');if(!v)return;
  v.innerHTML=`<div id="policies-header" class="page-heading-row"><h1 id="policies-title">Firewall Policy</h1></div><div id="policies-toolbar" class="toolbar"><button id="policy-create-button" class="btn-primary">＋ Create New</button><button id="policy-edit-button" class="btn-secondary" disabled>✎ Edit</button><button id="policy-delete-button" class="btn-secondary" disabled>▱ Delete</button><button id="policy-clone-button" class="btn-secondary" disabled>⧉ Clone</button><button id="policy-up-button" class="btn-secondary" disabled>↑</button><button id="policy-down-button" class="btn-secondary" disabled>↓</button><button id="test-traffic-button" class="btn-secondary">▶ Test Traffic</button></div><div id="policies-table-wrap" class="table-wrap full-table-wrap"><table id="policies-table" class="data-table"><thead><tr><th>Seq.</th><th>ID</th><th>Name</th><th>Incoming</th><th>Outgoing</th><th>Source</th><th>Destination</th><th>Schedule</th><th>Service</th><th>Action</th><th>NAT</th><th>Security</th><th>Log</th><th>Status</th></tr></thead><tbody id="policies-table-body"></tbody></table></div>`;
}

poInitState();poNav();poPolicyView();poViews();
const poCoreShowView=showView;
showView=function(name){poCoreShowView(name);if(['policies','addresses','internet-services','services','schedules','vips','ip-pools','protocol-options','traffic-shaping'].includes(name))$('nav-policy-objects')?.classList.add('active');if(poDefs[name])poRender(name);if(name==='internet-services')poRenderIsdb()};
