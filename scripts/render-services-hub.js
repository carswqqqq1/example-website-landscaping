#!/usr/bin/env node
/* Server-renders the services hub proof strip and service cards into
   services.html from services-data.js, using the same templates as
   services.js. Run after editing services-data.js: npm run render:services-hub */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const slots = {
  'services-hub-grid': { innerHTML: '', children: [] },
  'service-proof': { innerHTML: '', children: [] }
};
const window = {};
const document = {
  body: { classList: { contains: () => false }, dataset: {} },
  getElementById: (id) => slots[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({})
};
const context = vm.createContext({ window, document, URLSearchParams, console });
vm.runInContext(read('site-config.js'), context);
vm.runInContext(read('services-data.js'), context);
vm.runInContext(read('services.js'), context);

const indent = (html, pad) => html.replace(/<article /g, '\n' + pad + '<article ').trim();
let page = read('services.html');
const replaceSlot = (id, markup) => {
  const marked = new RegExp('(<div[^>]*id="' + id + '"[^>]*>)[\\s\\S]*?</div><!-- /' + id + ' -->');
  const empty = new RegExp('(<div[^>]*id="' + id + '"[^>]*>)</div>');
  const pattern = marked.test(page) ? marked : empty;
  if (!pattern.test(page)) throw new Error('slot not found: ' + id);
  page = page.replace(pattern, (match, open) => open + '\n' + markup + '\n        </div><!-- /' + id + ' -->');
};
if (!slots['services-hub-grid'].innerHTML || !slots['service-proof'].innerHTML) {
  throw new Error('services.js produced no hub markup');
}
replaceSlot('service-proof', '          ' + indent(slots['service-proof'].innerHTML, '          '));
replaceSlot('services-hub-grid', '          ' + indent(slots['services-hub-grid'].innerHTML, '          '));
fs.writeFileSync(path.join(root, 'services.html'), page);
console.log('services.html hub markup rendered');
