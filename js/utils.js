// Utility functions: esc, genId, showToast
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function showToast(msg) {
  const el = document.getElementById('shareToast');
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 3000);
}
