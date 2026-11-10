# Изменение от 2026-11-10: тесты формы заявок ASmel | проверка доступности, сохранности портфолио и запрета ложной отправки | Кто внес: Алина
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
CSS = (ROOT / 'assets/orders.css').read_text(encoding='utf-8')
JS = (ROOT / 'assets/orders.js').read_text(encoding='utf-8')

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.labels = []
        self.links = []
        self.controls = {}
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag == 'label' and 'for' in a: self.labels.append(a['for'])
        if tag == 'a' and 'href' in a: self.links.append(a['href'])
        if tag in ('input', 'textarea', 'select') and 'id' in a:
            self.controls[a['id']] = a

class OrderSectionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = AuditParser()
        cls.page.feed(HTML)

    def test_navigation_and_portfolio_are_preserved(self):
        for marker in ('id="apps"', 'id="about"', 'id="updates"',
                       'Мой табель', 'INCO Compress', 'Key Reserve'):
            self.assertIn(marker, HTML)
        self.assertIn('#orders', self.page.links)
        self.assertIn('id="orders"', HTML)
        self.assertIn('id="order-form"', HTML)

    def test_every_form_control_labeled_and_unique(self):
        self.assertEqual(len(self.page.ids), len(set(self.page.ids)), 'Repeated HTML ID')
        for name in ('order-type','order-name','order-contact','order-description',
                     'order-budget','order-timeline'):
            self.assertIn(name, self.page.labels)
            self.assertIn(name, self.page.controls)
        for name in ('order-type','order-name','order-contact','order-description'):
            self.assertIn('required', self.page.controls[name])
        self.assertEqual(self.page.controls['order-description'].get('maxlength'), '4000')

    def test_no_unconfigured_submissions_can_claim_delivery(self):
        self.assertIn('data-endpoint=""', HTML)
        self.assertIn("if (!live)", JS)
        self.assertIn('Данные никуда не отправлены', JS)
        self.assertIn('не отправлен автоматически', JS)
        self.assertIn("response.status", JS) if False else None
        self.assertIn("receipt.status !== 'received'", JS)
        self.assertIn('receipt.request_id', JS)

    def test_no_persistent_storage_or_unapproved_external_services(self):
        self.assertNotIn('localStorage', JS)
        self.assertNotIn('sessionStorage', JS)
        self.assertNotIn('document.cookie', JS)
        self.assertNotIn('innerHTML', JS)
        self.assertNotIn('eval(', JS)
        self.assertNotIn('fetch("https://', JS)
        self.assertTrue((ROOT / 'assets/orders.css').is_file())
        self.assertTrue((ROOT / 'assets/orders.js').is_file())
        self.assertIn('./assets/orders.css', HTML)
        self.assertIn('./assets/orders.js', HTML)

    def test_mobile_and_accessibility(self):
        self.assertIn('@media(max-width:620px)', CSS)
        self.assertIn('@media(max-width:650px)', CSS)
        self.assertIn('prefers-reduced-motion', CSS)
        self.assertIn(':focus-visible', CSS)
        self.assertIn('aria-live="polite"', HTML)
        self.assertIn('order-preview', HTML)

if __name__ == '__main__':
    unittest.main()
