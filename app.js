/* Bootstrap keeps the tested simulator core unchanged and layers the FortiOS log UI enhancement after it. */
document.write('<script src="app-core.js"></script>');
document.write('<script src="logs-enhancement.js"></script>');

document.addEventListener('DOMContentLoaded', () => {
  const group = document.getElementById('log-report-group');
  const parent = document.getElementById('nav-log-report');
  const subnav = document.getElementById('log-report-subnav');
  const chevron = parent?.querySelector('.nav-chevron');

  const closeLogReportMenu = () => {
    if (!parent || !subnav) return;
    subnav.hidden = true;
    group?.classList.remove('open');
    parent.setAttribute('aria-expanded', 'false');
    if (chevron) chevron.textContent = '›';
  };

  /* FortiOS-style default: the section is collapsed until the user opens it. */
  closeLogReportMenu();

  /* Leaving Log & Report collapses its submenu instead of leaving it open forever. */
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.id === 'nav-log-report') return;
    item.addEventListener('click', closeLogReportMenu);
  });
});
