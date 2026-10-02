// Direct story links must survive font/image layout changes on mobile Safari.
(() => {
  let cancel = () => {};
  const navigate = () => {
    cancel();
    if (!['#request', '#request-form'].includes(window.location.hash)) return;
    const target = document.getElementById(window.location.hash === '#request-form' ? 'request-form' : 'request');
    if (!target) return;
    let stopped = false;
    let observer;
    let timer;
    const inputs = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
    const stop = () => {
      stopped = true;
      observer?.disconnect();
      clearTimeout(timer);
      inputs.forEach(type => window.removeEventListener(type, stop));
    };
    cancel = stop;
    inputs.forEach(type => window.addEventListener(type, stop, {passive: true}));
    const align = () => {
      if (stopped) return;
      // Do not animate a jump whose destination can move while fonts load.
      // Align the golden section itself, ignoring global anchor padding that
      // would leave the previous diploma controls visible above it.
      window.scrollTo({top: Math.max(0, window.scrollY + target.getBoundingClientRect().top), behavior: 'instant'});
    };
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(resolve => window.addEventListener('load', resolve, {once: true}));
    Promise.all([loaded, document.fonts?.ready || Promise.resolve()]).then(() => {
      if (stopped) return;
      align();
      if ('ResizeObserver' in window) {
        observer = new ResizeObserver(align);
        observer.observe(document.body);
      }
      // Catch late lazy media without taking control after the visitor interacts.
      timer = setTimeout(stop, 5000);
    });
  };
  window.addEventListener('hashchange', navigate);
  window.addEventListener('pageshow', navigate);
  navigate();
})();
