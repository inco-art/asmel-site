// Изменение от 2026-11-10: блок заказов ASmel — подготовка заявки и защищённый контракт отправки | не имитировать доставку, не хранить персональные данные в браузере | Кто внес: Алина
// Изменение от 2026-11-11: API ASG Orders и согласие клиента | сервер принимает заявку только с consent=true, подтверждает регистрационный номер | Кто внес: Алина
(() => {
  'use strict';
  const form = document.getElementById('order-form');
  if (!form) return;

  const status = document.getElementById('order-status');
  const preview = document.getElementById('order-preview');
  const summary = document.getElementById('order-summary');
  const primary = document.getElementById('order-submit');
  const copy = document.getElementById('order-copy');
  const download = document.getElementById('order-download');
  const privacyRow = document.getElementById('order-consent-row');
  const modeNote = document.getElementById('order-mode-note');
  const endpoint = String(form.dataset.endpoint || '').trim();
  let prepared = '';

  function allowedEndpoint(value) {
    if (!value) return false;
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && parsed.username === '' && parsed.password === '';
    } catch { return false; }
  }
  const live = allowedEndpoint(endpoint);
  if (live) {
    primary.textContent = 'Отправить заявку';
    privacyRow.hidden = false;
    form.elements.consent.required = true;
    modeNote.textContent = 'Перед отправкой проверь данные. Мы используем их только для ответа по проекту.';
  } else if (endpoint) {
    modeNote.textContent = 'Приём заявок отключён: адрес сервера некорректен. Доступен черновик.';
  }

  const clean = (value, max = 4000) => String(value || '').trim().slice(0, max);
  function getData() {
    const data = new FormData(form);
    return {
      type: clean(data.get('type'), 80),
      name: clean(data.get('name'), 120),
      contact: clean(data.get('contact'), 200),
      description: clean(data.get('description'), 4000),
      budget: clean(data.get('budget'), 120) || 'Обсудим',
      timeline: clean(data.get('timeline'), 90) || 'Обсудим'
    };
  }
  function setStatus(text, kind = 'info') {
    status.textContent = text;
    status.dataset.kind = kind;
  }
  function formatData(data) {
    return [
      'ASmel Genesis — запрос на разработку',
      '',
      'Направление: ' + data.type,
      'Имя: ' + data.name,
      'Контакт для ответа: ' + data.contact,
      'Бюджет: ' + data.budget,
      'Срок: ' + data.timeline,
      '',
      'Описание задачи:',
      data.description
    ].join('\n');
  }
  form.addEventListener('input', () => {
    prepared = '';
    preview.hidden = true;
    setStatus('');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (form.elements.company_web_url.value.trim()) {
      setStatus('Не удалось обработать форму. Проверь поля и попробуй снова.', 'error');
      return;
    }
    const data = getData();
    if (data.name.length < 2 || data.contact.length < 4 || data.description.length < 20) {
      setStatus('Укажи имя, контакт и опиши задачу не менее чем в 20 символах.', 'error');
      return;
    }
    prepared = formatData(data);
    if (!live) {
      summary.textContent = prepared; // textContent: never insert customer text into HTML
      preview.hidden = false;
      setStatus('Черновик готов. Данные никуда не отправлены — скопируй или сохрани его.', 'success');
      return;
    }
    if (!form.elements.consent.checked) {
      setStatus('Для отправки необходимо согласие на обработку данных заявки.', 'error');
      return;
    }
    primary.disabled = true;
    setStatus('Отправляю заявку…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...data,consent:true}),
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error'
      });
      if (!response.ok) throw new Error('HTTP response not OK');
      const receipt = await response.json();
      if (!receipt || receipt.status !== 'received' || typeof receipt.request_id !== 'string' ||
          !/^[A-Za-z0-9_-]{6,80}$/.test(receipt.request_id)) {
        throw new Error('Invalid receipt');
      }
      setStatus('Заявка зарегистрирована. Номер: ' + receipt.request_id + '. Уведомления доставляются отдельно.', 'success');
      form.reset();
      prepared = '';
      preview.hidden = true;
    } catch {
      summary.textContent = prepared;
      preview.hidden = false;
      setStatus('Подтверждения доставки нет. Заявка сохранена только как черновик: скопируй её и свяжись с нами напрямую.', 'error');
    } finally {
      clearTimeout(timeout);
      primary.disabled = false;
    }
  });
  copy.addEventListener('click', async () => {
    if (!prepared) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(prepared);
      setStatus('Черновик скопирован. Он не отправлен автоматически.', 'success');
    } catch {
      setStatus('Не удалось скопировать. Используй кнопку «Скачать TXT» или выдели текст выше.', 'error');
    }
  });
  download.addEventListener('click', () => {
    if (!prepared) return;
    const blob = new Blob(['\uFEFF', prepared], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ASmel-zayavka.txt';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Черновик сохранён на устройство. Он не отправлен автоматически.', 'success');
  });
})();
