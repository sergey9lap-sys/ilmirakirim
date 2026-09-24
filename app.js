const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const cookieNotice = document.querySelector('#cookie-notice');
const cookieConsentName = 'ilmira_cookie_consent';
const metrikaCounterId = 113009416;
let metrikaStarted = false;

const hasCookieConsent = () => document.cookie
  .split('; ')
  .some(cookie => cookie === `${cookieConsentName}=accepted`);

const startMetrika = () => {
  if (metrikaStarted || !['ilmirakirim.ru', 'www.ilmirakirim.ru'].includes(window.location.hostname)) return;
  metrikaStarted = true;

  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (let j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, 'script', `https://mc.yandex.ru/metrika/tag.js?id=${metrikaCounterId}`, 'ym');

  window.ym(metrikaCounterId, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: window.location.href,
    accurateTrackBounce: true,
    trackLinks: true
  });
};

const saveCookieConsent = () => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${cookieConsentName}=accepted; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
};

const dismissCookieNotice = () => {
  cookieNotice.classList.add('is-closing');
  window.setTimeout(() => {
    cookieNotice.hidden = true;
    cookieNotice.setAttribute('aria-hidden', 'true');
  }, reduceMotion.matches ? 0 : 220);
};

if (hasCookieConsent()) {
  startMetrika();
} else {
  cookieNotice.hidden = false;
  cookieNotice.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => cookieNotice.classList.add('is-visible'));
}

cookieNotice.querySelector('.cookie-notice-accept').addEventListener('click', () => {
  saveCookieConsent();
  startMetrika();
  dismissCookieNotice();
});
cookieNotice.querySelector('.cookie-notice-close').addEventListener('click', dismissCookieNotice);

const serviceDialog = document.querySelector('#service-dialog');
const serviceForm = document.querySelector('#service-form');
const serviceMessages = {
  'Консультация «Код предпринимателя»': 'Хочу на консультацию',
  'Сессия «Личная стратегия предпринимателя»': 'Хочу на стратегическую сессию',
  'Индивидуальное сопровождение': 'Интересует индивидуальное сопровождение',
  'Премиум-группа': 'Хочу в группу'
};

const buildMessage = (form, data) => {
  const service = data.get('service');
  return form.dataset.message || serviceMessages[service] || 'Хочу записаться';
};

const copyMessage = async message => {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = message;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  }
};

const phoneLibrary = window.libphonenumber;
const featuredCountries = ['RU', 'BY', 'KZ', 'US', 'CA', 'DE', 'FR', 'IT', 'ES', 'GB'];
const countryNames = { RU: 'Россия', BY: 'Беларусь', KZ: 'Казахстан', US: 'США', CA: 'Канада', GB: 'Великобритания' };
const regionNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['ru'], { type: 'region' })
  : null;
const countryName = country => countryNames[country] || regionNames?.of(country) || country;

if (phoneLibrary) {
  const countries = phoneLibrary.getCountries();
  const orderedCountries = [
    ...featuredCountries.filter(country => countries.includes(country)),
    ...countries.filter(country => !featuredCountries.includes(country))
      .sort((a, b) => countryName(a).localeCompare(countryName(b), 'ru'))
  ];
  document.querySelectorAll('.phone-country-select').forEach(select => {
    const options = document.createDocumentFragment();
    orderedCountries.forEach(country => {
      const option = document.createElement('option');
      option.value = country;
      option.textContent = `${countryName(country)} +${phoneLibrary.getCountryCallingCode(country)}`;
      options.append(option);
    });
    select.replaceChildren(options);
    select.value = 'RU';
  });
}

const validatePhone = input => {
  const value = input.value.trim();
  const country = input.closest('form').querySelector('.phone-country-select').value;
  if (!value) {
    input.setCustomValidity('');
  } else if (!/^\+?[\d\s().-]+$/.test(value)) {
    input.setCustomValidity('Используйте только цифры, +, пробелы, скобки и дефисы.');
  } else if (!phoneLibrary) {
    input.setCustomValidity('Не удалось загрузить проверку номера. Обновите страницу и попробуйте снова.');
  } else {
    const parsed = phoneLibrary.parsePhoneNumberFromString(value, country);
    input.setCustomValidity(parsed?.isValid() && parsed.country === country
      ? ''
      : 'Проверьте номер и выбранную страну. Можно ввести номер с кодом + или без него.');
  }
};

document.querySelectorAll('.record-form').forEach(form => {
  const input = form.querySelector('input[type="tel"]');
  const country = form.querySelector('.phone-country-select');
  input.addEventListener('input', () => validatePhone(input));
  input.addEventListener('blur', () => validatePhone(input));
  country.addEventListener('change', () => {
    if (phoneLibrary) form.querySelector('.phone-country-code').textContent = `+${phoneLibrary.getCountryCallingCode(country.value)}`;
    validatePhone(input);
  });
});

document.querySelectorAll('.record-form').forEach(form => {
  const messengerButtons = Array.from(form.querySelectorAll('[data-messenger]'));
  form.addEventListener('submit', event => event.preventDefault());
  messengerButtons.forEach(button => button.addEventListener('click', () => {
    messengerButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    form.querySelectorAll('input[type="tel"]').forEach(input => validatePhone(input));
    if (!form.reportValidity()) return;
    const message = buildMessage(form, new FormData(form));
    const encodedMessage = encodeURIComponent(message);
    const urls = {
      telegram: `https://t.me/Ilmirakirim?text=${encodedMessage}`,
      whatsapp: `https://api.whatsapp.com/send/?phone=79174678700&text=${encodedMessage}`,
      max: 'https://max.ru/u/f9LHodD0cOLRWDX_zzh9jrKMMMfNdTBlYNt9mufT-kFZwIGb8zte1_3nHVA'
    };
    const url = urls[button.dataset.messenger];
    window.open(url, '_blank', 'noopener');
    if (button.dataset.messenger === 'max') {
      copyMessage(message).then(copied => {
        form.querySelector('.form-status').textContent = copied
          ? 'Сообщение скопировано. Вставьте его в открывшийся чат в Максе.'
          : `Макс открыт. Отправьте Ильмире сообщение: «${message}»`;
      });
      return;
    }
    form.querySelector('.form-status').textContent = '';
  }));
});

document.querySelectorAll('.service-cta[data-service]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const service = link.dataset.service;
    serviceForm.reset();
    const servicePhone = serviceForm.querySelector('input[type="tel"]');
    servicePhone.setCustomValidity('');
    serviceForm.querySelector('.phone-country-code').textContent = '+7';
    serviceForm.querySelector('input[name="service"]').value = service;
    serviceForm.dataset.message = serviceMessages[service] || 'Хочу записаться';
    serviceDialog.querySelector('#service-dialog-title').textContent = service;
    serviceForm.querySelector('.form-status').textContent = '';
    serviceForm.querySelectorAll('[data-messenger]').forEach(button => { button.setAttribute('aria-pressed', 'false'); });
    serviceDialog.showModal();
  });
});

serviceDialog.querySelector('.dialog-close').addEventListener('click', () => serviceDialog.close());
serviceDialog.addEventListener('click', event => {
  if (event.target !== serviceDialog) return;
  const rect = serviceDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) serviceDialog.close();
});

const dialog = document.querySelector('#lightbox');
document.querySelectorAll('[data-image]').forEach(button => {
  button.addEventListener('click', () => {
    const img = document.querySelector('#lightbox-image');
    img.src = button.dataset.image;
    img.alt = button.dataset.caption;
    document.querySelector('#lightbox-caption').textContent = button.dataset.caption;
    dialog.showModal();
  });
});
document.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

// Preserve wording; bind only short prepositions.
const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
const nodes = [];
while (walker.nextNode()) nodes.push(walker.currentNode);
for (const node of nodes) {
  if (node.parentElement.closest('script,style,textarea,option,select')) continue;
  node.textContent = node.textContent.replace(/(^|[\s(])(в|к|с|у|о|и|а|на|по|из|от|до|за|не|но|для|без|или|я) /giu, '$1$2\u00a0');
}

// Native scrolling keeps swipe, keyboard, and the no-JS fallback.
document.querySelectorAll('[data-carousel]').forEach(carousel => {
  const track = carousel.querySelector('.carousel-track');
  const slides = Array.from(track.children);
  const controls = carousel.querySelector('.carousel-controls');
  const prev = carousel.querySelector('.carousel-prev');
  const next = carousel.querySelector('.carousel-next');
  const count = carousel.querySelector('.carousel-count');
  controls.hidden = false;
  const measure = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = slides[0].getBoundingClientRect().width + gap;
    const visible = Math.max(1, Math.round((track.clientWidth + gap) / step));
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    const index = Math.min(slides.length - visible, Math.max(0, Math.round(track.scrollLeft / step)));
    return {step, visible, max, index};
  };
  let lastLabel = '';
  const refresh = () => {
    const {visible, max, index} = measure();
    const label = visible > 1 ? (index + 1) + '–' + Math.min(index + visible, slides.length) + ' / ' + slides.length : (index + 1) + ' / ' + slides.length;
    if (label !== lastLabel) { count.textContent = label; lastLabel = label; }
    prev.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft >= max - 2;
    carousel.querySelectorAll('.quote-body').forEach(body => {
      body.parentElement.querySelector('.quote-hint').hidden = body.scrollHeight <= body.clientHeight + 2;
    });
  };
  const move = (direction, keyboard) => {
    const {step, visible, max, index} = measure();
    track.scrollTo({left: Math.max(0, Math.min(max, (index + direction * visible) * step)), behavior: reduceMotion.matches || keyboard ? 'instant' : 'smooth'});
  };
  prev.addEventListener('click', event => move(-1, event.detail === 0));
  next.addEventListener('click', event => move(1, event.detail === 0));
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home' || event.key === 'End') {
      track.scrollTo({left: event.key === 'Home' ? 0 : measure().max, behavior: 'instant'});
    } else move(event.key === 'ArrowLeft' ? -1 : 1, true);
  });
  let frame;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(refresh);
  }, {passive: true});
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(track);
  document.fonts.ready.then(refresh);
  refresh();
});

// One-time hierarchy reveal; nothing is hidden before the observer runs.
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (reduceMotion.matches) return;
      const targets = entry.target.matches('.perspectives') ? Array.from(entry.target.children) : [entry.target];
      targets.forEach((target, index) => {
        target.animate(
          [{opacity: .45, transform: 'translateY(12px)'}, {opacity: 1, transform: 'translateY(0)'}],
          {duration: 500, delay: index * 50, easing: 'cubic-bezier(.23,1,.32,1)'}
        );
      });
    });
  }, {threshold: .06, rootMargin: '0px 0px -24px 0px'});
  document.querySelectorAll('main h2, .biography-list, .strategy-intro, .perspectives, .benefit-list, .source-service, [data-carousel], .paris-copy, .signup-panel, .source-contacts').forEach(el => observer.observe(el));
  reduceMotion.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    document.getAnimations().forEach(animation => animation.cancel());
  });
}
