/* Mission UPSC AI OS V30.0 — Smart Calendar Composer UX */
(() => {
  'use strict';

  const q = id => document.getElementById(id);
  const isoToday = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
  };
  const roundedTime = () => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  function prepareCalendarComposerV300() {
    const quickDate = q('calendarQuickDateV266');
    const aiDate = q('smartCalDateV4');
    const quickTime = q('calendarQuickTimeV266');
    if (quickDate && !quickDate.value) quickDate.value = isoToday();
    if (aiDate && !aiDate.value) aiDate.value = isoToday();
    if (quickTime && !quickTime.value) quickTime.value = roundedTime();
  }

  document.addEventListener('DOMContentLoaded', prepareCalendarComposerV300);
  document.addEventListener('click', event => {
    const sectionButton = event.target.closest('[onclick*="aiCalendarV4"]');
    if (sectionButton) setTimeout(prepareCalendarComposerV300, 100);
  });

  window.prepareCalendarComposerV300 = prepareCalendarComposerV300;
})();
