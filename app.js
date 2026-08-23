/* Bootstrap keeps the tested simulator core unchanged and layers the FortiOS log UI enhancement after it. */
document.write('<script src="app-core.js"></script>');
document.write('<script src="logs-enhancement.js"></script>');

document.addEventListener('DOMContentLoaded', () => {
  const groups = [...document.querySelectorAll('#sidebar-nav .nav-group')];

  const setGroupOpen = (group, open) => {
    if (!group) return;
    const parent = group.querySelector(':scope > .nav-parent');
    const subnav = group.querySelector(':scope > .subnav');
    if (!parent || !subnav) return;

    group.classList.toggle('open', open);
    subnav.hidden = !open;
    /* Inline display is intentional: base FortiOS CSS uses .subnav { display:block },
       so this guarantees the submenu really collapses when hidden. */
    subnav.style.display = open ? 'block' : 'none';
    parent.setAttribute('aria-expanded', String(open));

    const chevron = parent.querySelector('.nav-chevron');
    if (chevron) chevron.textContent = open ? '⌄' : '›';
  };

  const closeOtherGroups = currentGroup => {
    groups.forEach(group => {
      if (group !== currentGroup) setGroupOpen(group, false);
    });
  };

  /* FortiOS-style default: all expandable sections start collapsed. */
  groups.forEach(group => setGroupOpen(group, false));

  /* The existing simulator handlers decide open/closed state.
     This handler syncs the visual state and makes the sidebar a real accordion. */
  groups.forEach(group => {
    const parent = group.querySelector(':scope > .nav-parent');
    const subnav = group.querySelector(':scope > .subnav');
    if (!parent || !subnav) return;

    parent.addEventListener('click', () => {
      const willBeOpen = !subnav.hidden;
      if (willBeOpen) closeOtherGroups(group);
      setGroupOpen(group, willBeOpen);
    });
  });

  /* Clicking a normal top-level section closes every dropdown. */
  document.querySelectorAll('#sidebar-nav > .nav-item:not(.nav-parent)').forEach(item => {
    item.addEventListener('click', () => groups.forEach(group => setGroupOpen(group, false)));
  });
});
