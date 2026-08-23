const STORAGE_KEY = "fortigate-simulator-v1";

const defaultState = {
  interfaces: [
    { id: "if-wan", group: "Physical Interface", name: "wan", type: "Physical Interface", members: "", ip: "192.168.80.49", mask: "255.255.255.0", access: ["PING","HTTPS","SSH","HTTP"], dhcpClients: "", dhcpRange: "", ref: 13, enabled: true },
    { id: "if-internal2", group: "Physical Interface", name: "internal2", type: "Physical Interface", members: "", ip: "192.168.20.1", mask: "255.255.255.0", access: ["PING","HTTPS","SSH","HTTP"], dhcpClients: "", dhcpRange: "", ref: 3, enabled: true },
    { id: "if-dsl", group: "Physical Interface", name: "dsl", type: "Physical Interface", members: "", ip: "0.0.0.0", mask: "0.0.0.0", access: ["PING","FMG-Access"], dhcpClients: "", dhcpRange: "", ref: 1, enabled: false },
    { id: "if-dmz", group: "Physical Interface", name: "dmz", type: "Physical Interface", members: "", ip: "10.10.10.1", mask: "255.255.255.0", access: ["PING","HTTPS","FMG-Access"], dhcpClients: "", dhcpRange: "", ref: 0, enabled: true },
    { id: "if-lan", group: "Software Switch", name: "lan", type: "Software Switch", members: "internal", ip: "192.168.1.99", mask: "255.255.255.0", access: ["PING","HTTPS","SSH","HTTP","Security Fabric Connection"], dhcpClients: "2", dhcpRange: "192.168.1.50-192.168.1.150", ref: 13, enabled: true }
  ],
  routes: [
    { id: "rt-default", destination: "0.0.0.0/0", gateway: "192.168.80.1", interface: "wan", distance: 10, enabled: true },
    { id: "rt-lan", destination: "192.168.1.0/24", gateway: "0.0.0.0", interface: "lan", distance: 0, enabled: true },
    { id: "rt-dmz", destination: "10.10.10.0/24", gateway: "0.0.0.0", interface: "dmz", distance: 0, enabled: true }
  ],
  policies: [
    { id: 1, uid: "pol-1", name: "LAN-to-WAN", from: "lan", to: "wan", source: "LAN_Subnet", destination: "all", service: "ALL", action: "ACCEPT", nat: true, enabled: true },
    { id: 2, uid: "pol-2", name: "LAN-to-DMZ", from: "lan", to: "dmz", source: "LAN_Subnet", destination: "DMZ_Subnet", service: "ALL", action: "ACCEPT", nat: false, enabled: true },
    { id: 3, uid: "pol-3", name: "Deny-ALL", from: "all", to: "all", source: "all", destination: "all", service: "ALL", action: "DENY", nat: false, enabled: true }
  ],
  logs: [
    { id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), action: "ACCEPT", policy: 1, source: "192.168.1.50", destination: "8.8.8.8", service: "PING", reason: "Policy matched; NAT applied" }
  ]
};

let state = loadState();
let selectedInterfaceId = null;
let selectedRouteId = null;
let selectedPolicyUid = null;

const refs = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheDom();
  bindNavigation();
  bindInterfaceEvents();
  bindRouteEvents();
  bindPolicyEvents();
  bindLogEvents();
  bindModalEvents();
  bindCliEvents();
  bindResponsiveEvents();
  renderAll();
}

function cacheDom() {
  [
    "sidebar","sidebar-toggle","network-subnav","main-content",
    "interfaces-table-body","routes-table-body","policies-table-body","logs-table-body",
    "interface-create-button","interface-edit-button","interface-delete-button","interface-search",
    "route-create-button","route-delete-button","policy-create-button","policy-delete-button","test-traffic-button",
    "generate-log-button","clear-logs-button","modal-backdrop","modal-panel","modal-title","modal-body","modal-actions","modal-close-button",
    "cli-open-button","cli-panel","cli-close-button","cli-output","cli-input",
    "interfaces-summary-body","policy-summary-body","log-summary-body",
    "topology-wan-ip","topology-lan-ip","topology-dmz-ip"
  ].forEach(id => refs[id] = document.getElementById(id));
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view === "placeholder") {
        document.getElementById("placeholder-title").textContent = button.dataset.title || "Module";
      }
      showView(view);
    });
  });

  document.querySelectorAll("[data-toggle='network-subnav']").forEach(button => {
    button.addEventListener("click", () => {
      refs["network-subnav"].hidden = !refs["network-subnav"].hidden;
    });
  });
}

function showView(view) {
  document.querySelectorAll(".app-view").forEach(el => el.classList.remove("active-view"));
  document.querySelectorAll(".nav-item,.subnav-item").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(`view-${view}`) || document.getElementById("view-placeholder");
  target.classList.add("active-view");

  const matchingButton = document.querySelector(`[data-view="${view}"]`);
  if (matchingButton) matchingButton.classList.add("active");

  if (window.innerWidth <= 760) refs.sidebar.classList.remove("mobile-open");
}

function bindInterfaceEvents() {
  refs["interface-create-button"].addEventListener("click", () => openInterfaceModal());
  refs["interface-edit-button"].addEventListener("click", () => {
    const item = state.interfaces.find(x => x.id === selectedInterfaceId);
    if (item) openInterfaceModal(item);
  });
  refs["interface-delete-button"].addEventListener("click", deleteSelectedInterface);
  refs["interface-search"].addEventListener("input", renderInterfaces);
}

function bindRouteEvents() {
  refs["route-create-button"].addEventListener("click", openRouteModal);
  refs["route-delete-button"].addEventListener("click", deleteSelectedRoute);
}

function bindPolicyEvents() {
  refs["policy-create-button"].addEventListener("click", openPolicyModal);
  refs["policy-delete-button"].addEventListener("click", deleteSelectedPolicy);
  refs["test-traffic-button"].addEventListener("click", openTrafficTestModal);
}

function bindLogEvents() {
  refs["generate-log-button"].addEventListener("click", openTrafficTestModal);
  refs["clear-logs-button"].addEventListener("click", () => {
    state.logs = [];
    saveState();
    renderLogs();
    renderDashboardSummaries();
  });
}

function bindModalEvents() {
  refs["modal-close-button"].addEventListener("click", closeModal);
  refs["modal-backdrop"].addEventListener("click", e => {
    if (e.target === refs["modal-backdrop"]) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeModal();
      refs["cli-panel"].hidden = true;
    }
  });
}

function bindCliEvents() {
  refs["cli-open-button"].addEventListener("click", () => {
    refs["cli-panel"].hidden = false;
    refs["cli-input"].focus();
  });
  refs["cli-close-button"].addEventListener("click", () => refs["cli-panel"].hidden = true);
  refs["cli-input"].addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const cmd = refs["cli-input"].value.trim();
    refs["cli-input"].value = "";
    runCliCommand(cmd);
  });
}

function bindResponsiveEvents() {
  refs["sidebar-toggle"].addEventListener("click", () => refs.sidebar.classList.toggle("mobile-open"));
}

function renderAll() {
  renderInterfaces();
  renderRoutes();
  renderPolicies();
  renderLogs();
  renderDashboardSummaries();
}

function renderInterfaces() {
  const search = (refs["interface-search"]?.value || "").toLowerCase();
  const filtered = state.interfaces.filter(item =>
    [item.name,item.type,item.ip,item.group,item.members].join(" ").toLowerCase().includes(search)
  );

  refs["interfaces-table-body"].innerHTML = "";
  let lastGroup = null;

  filtered.forEach(item => {
    if (item.group !== lastGroup) {
      const groupRow = document.createElement("tr");
      groupRow.className = "group-row";
      groupRow.innerHTML = `<td colspan="8">⊟ ${escapeHtml(item.group)}</td>`;
      refs["interfaces-table-body"].appendChild(groupRow);
      lastGroup = item.group;
    }

    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    if (item.id === selectedInterfaceId) tr.classList.add("selected");
    tr.innerHTML = `
      <td>${item.enabled ? "▣" : "▤"} <strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.members || "")}</td>
      <td>${escapeHtml(item.ip)}/${escapeHtml(item.mask)}</td>
      <td>${item.access.map(x => `<span class="access-chip">${escapeHtml(x)}</span>`).join("")}</td>
      <td>${escapeHtml(item.dhcpClients || "")}</td>
      <td>${escapeHtml(item.dhcpRange || "")}</td>
      <td>${item.ref}</td>`;
    tr.addEventListener("click", () => {
      selectedInterfaceId = item.id;
      renderInterfaces();
      updateSelectionButtons();
    });
    tr.addEventListener("dblclick", () => openInterfaceModal(item));
    refs["interfaces-table-body"].appendChild(tr);
  });

  updateSelectionButtons();
}

function renderRoutes() {
  refs["routes-table-body"].innerHTML = "";
  state.routes.forEach(route => {
    const tr = document.createElement("tr");
    tr.dataset.id = route.id;
    if (route.id === selectedRouteId) tr.classList.add("selected");
    tr.innerHTML = `
      <td>${escapeHtml(route.destination)}</td>
      <td>${escapeHtml(route.gateway)}</td>
      <td>▣ ${escapeHtml(route.interface)}</td>
      <td>${route.distance}</td>
      <td class="${route.enabled ? "status-enabled" : "status-down"}">${route.enabled ? "● Enabled" : "● Disabled"}</td>`;
    tr.addEventListener("click", () => {
      selectedRouteId = route.id;
      renderRoutes();
      updateSelectionButtons();
    });
    refs["routes-table-body"].appendChild(tr);
  });
  updateSelectionButtons();
}

function renderPolicies() {
  refs["policies-table-body"].innerHTML = "";
  state.policies.forEach(policy => {
    const tr = document.createElement("tr");
    tr.dataset.uid = policy.uid;
    if (policy.uid === selectedPolicyUid) tr.classList.add("selected");
    tr.innerHTML = `
      <td>${policy.id}</td>
      <td><strong>${escapeHtml(policy.name)}</strong></td>
      <td>▣ ${escapeHtml(policy.from)}</td>
      <td>▣ ${escapeHtml(policy.to)}</td>
      <td>${escapeHtml(policy.source)}</td>
      <td>${escapeHtml(policy.destination)}</td>
      <td>${escapeHtml(policy.service)}</td>
      <td class="${policy.action === "ACCEPT" ? "status-accept" : "status-deny"}">${policy.action === "ACCEPT" ? "✓" : "✕"} ${policy.action}</td>
      <td class="${policy.nat ? "status-accept" : "status-deny"}">${policy.nat ? "● Yes" : "✕ No"}</td>`;
    tr.addEventListener("click", () => {
      selectedPolicyUid = policy.uid;
      renderPolicies();
      updateSelectionButtons();
    });
    refs["policies-table-body"].appendChild(tr);
  });
  updateSelectionButtons();
}

function renderLogs() {
  refs["logs-table-body"].innerHTML = "";
  state.logs.slice().reverse().forEach(log => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(log.time)}</td>
      <td class="${log.action === "ACCEPT" ? "status-accept" : "status-deny"}">${log.action === "ACCEPT" ? "✓" : "✕"} ${log.action}</td>
      <td>${escapeHtml(String(log.policy))}</td>
      <td>${escapeHtml(log.source)}</td>
      <td>${escapeHtml(log.destination)}</td>
      <td>${escapeHtml(log.service)}</td>
      <td>${escapeHtml(log.reason)}</td>`;
    refs["logs-table-body"].appendChild(tr);
  });
}

function renderDashboardSummaries() {
  refs["interfaces-summary-body"].innerHTML = buildMiniTable(
    ["Name","IP/Netmask","Access"],
    state.interfaces.slice(0,5).map(i => [i.name, `${i.ip}/${i.mask}`, i.access.slice(0,3).join(" ")])
  );

  refs["policy-summary-body"].innerHTML = buildMiniTable(
    ["ID","Name","From","To","Action","NAT"],
    state.policies.slice(0,5).map(p => [p.id,p.name,p.from,p.to,p.action,p.nat ? "Yes" : "No"])
  );

  refs["log-summary-body"].innerHTML = buildMiniTable(
    ["Time","Action","Source","Destination"],
    state.logs.slice(-6).reverse().map(l => [l.time,l.action,l.source,l.destination])
  );

  const wan = state.interfaces.find(i => i.name === "wan");
  const lan = state.interfaces.find(i => i.name === "lan");
  const dmz = state.interfaces.find(i => i.name === "dmz");
  refs["topology-wan-ip"].textContent = wan?.ip || "—";
  refs["topology-lan-ip"].textContent = lan?.ip || "—";
  refs["topology-dmz-ip"].textContent = dmz?.ip || "—";
}

function buildMiniTable(headers, rows) {
  return `<table class="data-table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(String(h))}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function updateSelectionButtons() {
  refs["interface-edit-button"].disabled = !selectedInterfaceId;
  refs["interface-delete-button"].disabled = !selectedInterfaceId;
  refs["route-delete-button"].disabled = !selectedRouteId;
  refs["policy-delete-button"].disabled = !selectedPolicyUid;
}

function openInterfaceModal(item = null) {
  const isEdit = Boolean(item);
  openModal(
    isEdit ? "Edit Interface" : "Create New Interface",
    `
      <div class="form-grid">
        <div class="field"><label for="if-name">Name</label><input id="if-name" value="${escapeAttr(item?.name || "")}" /></div>
        <div class="field"><label for="if-type">Type</label>
          <select id="if-type">
            ${["Physical Interface","Software Switch","VLAN"].map(x=>`<option ${item?.type===x?"selected":""}>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label for="if-ip">IP Address</label><input id="if-ip" value="${escapeAttr(item?.ip || "192.168.10.1")}" /></div>
        <div class="field"><label for="if-mask">Netmask</label><input id="if-mask" value="${escapeAttr(item?.mask || "255.255.255.0")}" /></div>
        <div class="field"><label for="if-members">Members</label><input id="if-members" value="${escapeAttr(item?.members || "")}" /></div>
        <div class="field"><label for="if-group">Group</label>
          <select id="if-group">
            ${["Physical Interface","Software Switch","VLAN Interface"].map(x=>`<option ${item?.group===x?"selected":""}>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field full">
          <label>Administrative Access</label>
          <div class="check-row">
            ${["PING","HTTPS","SSH","HTTP","FMG-Access","Security Fabric Connection"].map(x => `
              <label><input type="checkbox" name="if-access" value="${x}" ${(item?.access || ["PING","HTTPS"]).includes(x) ? "checked" : ""}> ${x}</label>
            `).join("")}
          </div>
        </div>
        <div class="field"><label for="if-dhcp-range">DHCP Range</label><input id="if-dhcp-range" value="${escapeAttr(item?.dhcpRange || "")}" placeholder="192.168.10.50-192.168.10.150" /></div>
        <div class="field"><label for="if-enabled">Status</label>
          <select id="if-enabled"><option value="true" ${item?.enabled !== false ? "selected":""}>Enabled</option><option value="false" ${item?.enabled === false ? "selected":""}>Disabled</option></select>
        </div>
      </div>`,
    [
      { label: "Cancel", className: "btn-secondary", action: closeModal },
      { label: isEdit ? "OK" : "Create", className: "btn-primary", action: () => saveInterface(item?.id) }
    ]
  );
}

function saveInterface(existingId = null) {
  const name = document.getElementById("if-name").value.trim();
  const ip = document.getElementById("if-ip").value.trim();
  const mask = document.getElementById("if-mask").value.trim();

  if (!name || !isIPv4(ip) || !isIPv4(mask)) {
    alert("Enter a valid name, IPv4 address and netmask.");
    return;
  }

  const access = [...document.querySelectorAll('input[name="if-access"]:checked')].map(x => x.value);
  const payload = {
    id: existingId || crypto.randomUUID(),
    group: document.getElementById("if-group").value,
    name,
    type: document.getElementById("if-type").value,
    members: document.getElementById("if-members").value.trim(),
    ip,
    mask,
    access,
    dhcpClients: "",
    dhcpRange: document.getElementById("if-dhcp-range").value.trim(),
    ref: existingId ? (state.interfaces.find(i=>i.id===existingId)?.ref || 0) : 0,
    enabled: document.getElementById("if-enabled").value === "true"
  };

  if (existingId) {
    const index = state.interfaces.findIndex(i => i.id === existingId);
    state.interfaces[index] = payload;
  } else {
    state.interfaces.push(payload);
  }

  saveState();
  closeModal();
  renderInterfaces();
  renderDashboardSummaries();
}

function deleteSelectedInterface() {
  const item = state.interfaces.find(i => i.id === selectedInterfaceId);
  if (!item) return;
  if (["wan","lan"].includes(item.name)) {
    alert("Core WAN/LAN interfaces are protected in this simulator stage.");
    return;
  }
  if (!confirm(`Delete interface "${item.name}"?`)) return;
  state.interfaces = state.interfaces.filter(i => i.id !== selectedInterfaceId);
  selectedInterfaceId = null;
  saveState();
  renderAll();
}

function openRouteModal() {
  const interfaceOptions = state.interfaces.map(i => `<option>${escapeHtml(i.name)}</option>`).join("");
  openModal("Create Static Route", `
    <div class="form-grid">
      <div class="field"><label for="route-destination">Destination</label><input id="route-destination" value="0.0.0.0/0" /></div>
      <div class="field"><label for="route-gateway">Gateway</label><input id="route-gateway" value="192.168.80.1" /></div>
      <div class="field"><label for="route-interface">Interface</label><select id="route-interface">${interfaceOptions}</select></div>
      <div class="field"><label for="route-distance">Administrative Distance</label><input id="route-distance" type="number" min="0" value="10" /></div>
    </div>`,
    [
      { label: "Cancel", className: "btn-secondary", action: closeModal },
      { label: "Create", className: "btn-primary", action: saveRoute }
    ]
  );
}

function saveRoute() {
  const destination = document.getElementById("route-destination").value.trim();
  const gateway = document.getElementById("route-gateway").value.trim();
  if (!isCIDR(destination) || !isIPv4(gateway)) {
    alert("Enter a valid destination CIDR and gateway.");
    return;
  }
  state.routes.push({
    id: crypto.randomUUID(),
    destination,
    gateway,
    interface: document.getElementById("route-interface").value,
    distance: Number(document.getElementById("route-distance").value || 10),
    enabled: true
  });
  saveState();
  closeModal();
  renderRoutes();
}

function deleteSelectedRoute() {
  if (!selectedRouteId) return;
  const route = state.routes.find(r => r.id === selectedRouteId);
  if (!route) return;
  if (!confirm(`Delete route ${route.destination}?`)) return;
  state.routes = state.routes.filter(r => r.id !== selectedRouteId);
  selectedRouteId = null;
  saveState();
  renderRoutes();
}

function openPolicyModal() {
  const interfaceOptions = ["all", ...state.interfaces.map(i => i.name)];
  openModal("Create Firewall Policy", `
    <div class="form-grid">
      <div class="field"><label for="policy-name">Name</label><input id="policy-name" value="New-Policy" /></div>
      <div class="field"><label for="policy-action">Action</label><select id="policy-action"><option>ACCEPT</option><option>DENY</option></select></div>
      <div class="field"><label for="policy-from">Incoming Interface</label><select id="policy-from">${interfaceOptions.map(x=>`<option>${x}</option>`).join("")}</select></div>
      <div class="field"><label for="policy-to">Outgoing Interface</label><select id="policy-to">${interfaceOptions.map(x=>`<option>${x}</option>`).join("")}</select></div>
      <div class="field"><label for="policy-source">Source</label><input id="policy-source" value="all" /></div>
      <div class="field"><label for="policy-destination">Destination</label><input id="policy-destination" value="all" /></div>
      <div class="field"><label for="policy-service">Service</label><select id="policy-service"><option>ALL</option><option>PING</option><option>HTTP</option><option>HTTPS</option><option>DNS</option><option>RDP</option></select></div>
      <div class="field"><label for="policy-nat">NAT</label><select id="policy-nat"><option value="true">ON</option><option value="false">OFF</option></select></div>
    </div>`,
    [
      { label: "Cancel", className: "btn-secondary", action: closeModal },
      { label: "Create", className: "btn-primary", action: savePolicy }
    ]
  );
}

function savePolicy() {
  const nextId = Math.max(0, ...state.policies.map(p => p.id)) + 1;
  state.policies.splice(Math.max(0, state.policies.length - 1), 0, {
    id: nextId,
    uid: crypto.randomUUID(),
    name: document.getElementById("policy-name").value.trim() || `Policy-${nextId}`,
    from: document.getElementById("policy-from").value,
    to: document.getElementById("policy-to").value,
    source: document.getElementById("policy-source").value.trim() || "all",
    destination: document.getElementById("policy-destination").value.trim() || "all",
    service: document.getElementById("policy-service").value,
    action: document.getElementById("policy-action").value,
    nat: document.getElementById("policy-nat").value === "true",
    enabled: true
  });
  saveState();
  closeModal();
  renderPolicies();
  renderDashboardSummaries();
}

function deleteSelectedPolicy() {
  if (!selectedPolicyUid) return;
  const policy = state.policies.find(p => p.uid === selectedPolicyUid);
  if (!policy) return;
  if (!confirm(`Delete policy "${policy.name}"?`)) return;
  state.policies = state.policies.filter(p => p.uid !== selectedPolicyUid);
  selectedPolicyUid = null;
  saveState();
  renderPolicies();
  renderDashboardSummaries();
}

function openTrafficTestModal() {
  openModal("Test Traffic", `
    <div class="form-grid">
      <div class="field"><label for="test-source">Source IP</label><input id="test-source" value="192.168.1.50" /></div>
      <div class="field"><label for="test-destination">Destination IP</label><input id="test-destination" value="8.8.8.8" /></div>
      <div class="field"><label for="test-incoming">Incoming Interface</label><select id="test-incoming">${state.interfaces.map(i=>`<option>${i.name}</option>`).join("")}</select></div>
      <div class="field"><label for="test-outgoing">Outgoing Interface</label><select id="test-outgoing">${state.interfaces.map(i=>`<option>${i.name}</option>`).join("")}</select></div>
      <div class="field"><label for="test-service">Service</label><select id="test-service"><option>PING</option><option>HTTP</option><option>HTTPS</option><option>DNS</option><option>RDP</option></select></div>
      <div class="field"><label>Simulator Logic</label><div class="muted">Route → Policy → NAT → Result</div></div>
    </div>`,
    [
      { label: "Cancel", className: "btn-secondary", action: closeModal },
      { label: "Run Test", className: "btn-primary", action: runTrafficTestFromModal }
    ]
  );

  const lan = state.interfaces.find(i => i.name === "lan");
  const wan = state.interfaces.find(i => i.name === "wan");
  if (lan) document.getElementById("test-incoming").value = "lan";
  if (wan) document.getElementById("test-outgoing").value = "wan";
}

function runTrafficTestFromModal() {
  const source = document.getElementById("test-source").value.trim();
  const destination = document.getElementById("test-destination").value.trim();
  const incoming = document.getElementById("test-incoming").value;
  const outgoing = document.getElementById("test-outgoing").value;
  const service = document.getElementById("test-service").value;

  if (!isIPv4(source) || !isIPv4(destination)) {
    alert("Enter valid source and destination IPv4 addresses.");
    return;
  }

  const result = evaluateTraffic({ source, destination, incoming, outgoing, service });
  state.logs.push({
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString(),
    action: result.action,
    policy: result.policyId,
    source,
    destination,
    service,
    reason: result.reason
  });

  if (state.logs.length > 200) state.logs = state.logs.slice(-200);
  saveState();
  renderLogs();
  renderDashboardSummaries();
  closeModal();

  alert(`${result.action}\n${result.reason}`);
}

function evaluateTraffic({ source, destination, incoming, outgoing, service }) {
  const matchingRoute = findBestRoute(destination, outgoing);
  if (!matchingRoute && outgoing === "wan") {
    return { action: "DENY", policyId: "-", reason: "No route to destination" };
  }

  const policy = state.policies.find(p =>
    p.enabled &&
    (p.from === incoming || p.from === "all") &&
    (p.to === outgoing || p.to === "all") &&
    (p.service === service || p.service === "ALL")
  );

  if (!policy) return { action: "DENY", policyId: "-", reason: "Implicit deny: no matching firewall policy" };
  if (policy.action === "DENY") return { action: "DENY", policyId: policy.id, reason: `Denied by policy ${policy.name}` };

  if (outgoing === "wan" && !policy.nat) {
    return { action: "DENY", policyId: policy.id, reason: "Policy matched but source NAT is disabled for Internet traffic" };
  }

  return {
    action: "ACCEPT",
    policyId: policy.id,
    reason: outgoing === "wan" && policy.nat
      ? `Policy ${policy.name} matched; route found; source NAT applied`
      : `Policy ${policy.name} matched; route found`
  };
}

function findBestRoute(destination, outgoing) {
  const routes = state.routes.filter(r => r.enabled && r.interface === outgoing);
  const exact = routes.find(r => cidrContains(r.destination, destination));
  if (exact) return exact;
  return routes.find(r => r.destination === "0.0.0.0/0") || null;
}

function runCliCommand(command) {
  if (!command) return;
  appendCli(`FG-SIM-01 # ${command}`);

  const normalized = command.toLowerCase();

  if (normalized === "get router info routing-table all") {
    appendCli("\nRouting table (simulated)");
    state.routes.forEach(r => appendCli(`${r.enabled ? "S" : "S*"} ${r.destination} via ${r.gateway}, ${r.interface}, distance ${r.distance}`));
  } else if (normalized === "get system interface physical") {
    appendCli("\nPhysical interface status (simulated)");
    state.interfaces.filter(i => i.type === "Physical Interface").forEach(i => {
      appendCli(`${i.name}: ${i.enabled ? "up" : "down"} ${i.ip}/${i.mask}`);
    });
  } else if (normalized.startsWith("execute ping ")) {
    const ip = command.split(/\s+/).pop();
    if (!isIPv4(ip)) {
      appendCli("Invalid IP address.");
    } else {
      const result = evaluateTraffic({
        source: state.interfaces.find(i=>i.name==="lan")?.ip || "192.168.1.99",
        destination: ip,
        incoming: "lan",
        outgoing: "wan",
        service: "PING"
      });
      appendCli(result.action === "ACCEPT"
        ? `PING ${ip}: 56 data bytes\n64 bytes from ${ip}: icmp_seq=0 ttl=117 time=12.4 ms\n--- ${ip} ping statistics ---\n1 packets transmitted, 1 packets received, 0% packet loss`
        : `PING ${ip}: timeout\nReason: ${result.reason}`);
    }
  } else if (normalized.startsWith("diagnose sniffer packet")) {
    appendCli("\ninterfaces=[any]\nfilters=[simulated]\n0.000000 lan in 192.168.1.50 -> 8.8.8.8: icmp: echo request\n0.012400 wan out 192.168.80.49 -> 8.8.8.8: icmp: echo request");
  } else if (normalized === "help" || normalized === "?") {
    appendCli("\nSupported simulator commands:\nget router info routing-table all\nget system interface physical\nexecute ping <ip>\ndiagnose sniffer packet any 'host <ip>' 4 0 l\nclear");
  } else if (normalized === "clear") {
    refs["cli-output"].textContent = "";
  } else {
    appendCli(`Command fail. Return code -61\nType "help" for supported simulator commands.`);
  }

  appendCli("");
}

function appendCli(text) {
  refs["cli-output"].textContent += `\n${text}`;
  refs["cli-output"].scrollTop = refs["cli-output"].scrollHeight;
}

function openModal(title, bodyHtml, actions) {
  refs["modal-title"].textContent = title;
  refs["modal-body"].innerHTML = bodyHtml;
  refs["modal-actions"].innerHTML = "";
  actions.forEach(action => {
    const btn = document.createElement("button");
    btn.className = action.className;
    btn.textContent = action.label;
    btn.addEventListener("click", action.action);
    refs["modal-actions"].appendChild(btn);
  });
  refs["modal-backdrop"].hidden = false;
}

function closeModal() {
  refs["modal-backdrop"].hidden = true;
  refs["modal-body"].innerHTML = "";
  refs["modal-actions"].innerHTML = "";
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.interfaces) || !Array.isArray(parsed.routes) || !Array.isArray(parsed.policies) || !Array.isArray(parsed.logs)) {
      return structuredClone(defaultState);
    }
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isIPv4(value) {
  const parts = value.split(".");
  return parts.length === 4 && parts.every(part => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isCIDR(value) {
  const [ip, prefix] = value.split("/");
  return isIPv4(ip) && /^\d+$/.test(prefix || "") && Number(prefix) >= 0 && Number(prefix) <= 32;
}

function ipToInt(ip) {
  return ip.split(".").reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0) >>> 0;
}

function cidrContains(cidr, ip) {
  if (cidr === "0.0.0.0/0") return true;
  if (!isCIDR(cidr) || !isIPv4(ip)) return false;
  const [network, prefixText] = cidr.split("/");
  const prefix = Number(prefixText);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipToInt(network) & mask) === (ipToInt(ip) & mask);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
