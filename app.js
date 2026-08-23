/* Bootstrap keeps the tested simulator core unchanged and layers FortiOS feature modules after it. */
document.write('<script src="app-core.js"></script>');
document.write('<script src="logs-enhancement.js"></script>');
document.write('<script src="policy-state-nav.js"></script>');
document.write('<script src="policy-firewall.js"></script>');
document.write('<script src="policy-objects.js"></script>');
document.write('<script src="policy-engine.js"></script>');
document.write('<script src="routes-enhancement.js"></script>');
document.write('<script src="vlan-enhancement.js"></script>');
document.write('<script src="vpn-enhancement.js"></script>');

document.addEventListener('DOMContentLoaded', () => {
  const groups = [...document.querySelectorAll('#sidebar-nav .nav-group')];

  const setGroupOpen = (group, open) => {
    if (!group) return;
    const parent = group.querySelector(':scope > .nav-parent');
    const subnav = group.querySelector(':scope > .subnav');
    if (!parent || !subnav) return;

    group.classList.toggle('open', open);
    subnav.hidden = !open;
    subnav.style.display = open ? 'block' : 'none';
    parent.setAttribute('aria-expanded', String(open));

    /* FortiOS behavior: down arrow = list visible, right arrow = list hidden. */
    const chevron = parent.querySelector('.nav-chevron');
    if (chevron) chevron.textContent = open ? '⌄' : '›';
  };

  const isGroupOpen = group => {
    const subnav = group?.querySelector(':scope > .subnav');
    return Boolean(subnav && !subnav.hidden && subnav.style.display !== 'none');
  };

  const closeOtherGroups = currentGroup => {
    groups.forEach(group => {
      if (group !== currentGroup) setGroupOpen(group, false);
    });
  };

  /* Start collapsed. */
  groups.forEach(group => setGroupOpen(group, false));

  /* Own the click before older sidebar handlers run, so arrow and list can never get out of sync. */
  groups.forEach(group => {
    const parent = group.querySelector(':scope > .nav-parent');
    if (!parent) return;

    parent.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const shouldOpen = !isGroupOpen(group);
      if (shouldOpen) closeOtherGroups(group);
      setGroupOpen(group, shouldOpen);
    }, true);
  });

  /* Clicking a normal top-level section closes every dropdown. */
  document.querySelectorAll('#sidebar-nav > .nav-item:not(.nav-parent)').forEach(item => {
    item.addEventListener('click', () => groups.forEach(group => setGroupOpen(group, false)));
  });
});
