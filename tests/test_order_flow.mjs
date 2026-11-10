// Изменение от 2026-11-10: тест подтверждения доставки с согласием | проверять ответ сервера, а не блокировку ввода до согласия | Кто внес: Алина
// Изменение от 2026-11-10: тесты клиентского режима заказов | черновик без отправки, независимое подтверждение сервера и защита от ложного успеха | Кто внес: Алина
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/orders.js',import.meta.url),'utf8');

function createHarness(endpoint='',fetchStub=async()=>{throw new Error('Unexpected network')}) {
  const nodes = new Map();
  const make = (id,initial={}) => {
    const o={id,textContent:'',dataset:{},hidden:false,disabled:false,events:{},
      addEventListener(name,fn){this.events[name]=fn;},...initial};
    nodes.set(id,o);
    return o;
  };
  const form=make('order-form',{
    dataset:{endpoint},
    elements:{company_web_url:{value:''},consent:{checked:false,required:false}},
    reportValidity(){return true;},
    reset(){this.didReset=true;}
  });
  for(const id of ['order-status','order-preview','order-summary','order-submit','order-copy','order-download','order-consent-row','order-mode-note'])make(id);
  nodes.get('order-preview').hidden=true;nodes.get('order-consent-row').hidden=true;
  const fieldData={
    type:'Сайт или лендинг',
    name:'Тестовый клиент',
    contact:'@test_account',
    description:'Нужен адаптивный сайт с каталогом и формой обратной связи.',
    budget:'',
    timeline:''
  };
  const calls=[];
  const context={
    document:{
      getElementById:id=>nodes.get(id),
      createElement:()=>({click(){},remove(){}}),
      body:{append(){}}
    },
    navigator:{clipboard:{async writeText(value){calls.push({copy:value})}}},
    FormData:class {constructor(){} get(key){return fieldData[key]??'';}},
    fetch:async(...args)=>{calls.push({fetch:args});return fetchStub(...args);},
    URL,Blob,AbortController,setTimeout,clearTimeout
  };
  vm.runInNewContext(source,context,{timeout:3000});
  return {form,nodes,fieldData,calls};
}

test('without a configured endpoint, builds a draft and never contacts the network',async()=>{
  const h=createHarness();
  await h.form.events.submit({preventDefault(){}});
  assert.equal(h.calls.length,0);
  assert.equal(h.nodes.get('order-preview').hidden,false);
  assert.match(h.nodes.get('order-summary').textContent,/Сайт или лендинг/);
  assert.match(h.nodes.get('order-status').textContent,/никуда не отправлены/);
  await h.nodes.get('order-copy').events.click();
  assert.equal(h.calls.length,1);
  assert.ok(h.calls[0].copy.includes('@test_account'));
});

test('malformed endpoint is not contacted',async()=>{
  const h=createHarness('javascript:alert(1)');
  await h.form.events.submit({preventDefault(){}});
  assert.equal(h.calls.length,0);
  assert.match(h.nodes.get('order-status').textContent,/никуда не отправлены/);
});

test('configured HTTPS endpoint requires a confirmed server receipt to claim success',async()=>{
  const h=createHarness('https://example.test/api/orders',async()=>({
    ok:true,async json(){return {status:'received',request_id:'ASG_20261110_0001'};}
  }));
  h.form.elements.consent.checked=true;
  await h.form.events.submit({preventDefault(){}});
  assert.equal(h.calls.filter(x=>x.fetch).length,1);
  const [url,request]=h.calls.find(x=>x.fetch).fetch;
  assert.equal(url,'https://example.test/api/orders');
  assert.equal(request.method,'POST');
  assert.equal(request.credentials,'omit');
  assert.match(h.nodes.get('order-status').textContent,/ASG_20261110_0001/);
  assert.equal(h.form.didReset,true);
});

test('server response without receipt is never treated as accepted',async()=>{
  const h=createHarness('https://example.test/api/orders',async()=>({
    ok:true,async json(){return {ok:true};}
  }));
  h.form.elements.consent.checked=true;
  await h.form.events.submit({preventDefault(){}});
  assert.equal(h.nodes.get('order-preview').hidden,false);
  assert.match(h.nodes.get('order-status').textContent,/Подтверждения доставки нет/);
  assert.equal(h.form.didReset,undefined);
});

test('honeypot rejects bot content before network',async()=>{
  const h=createHarness('https://example.test/api/orders');
  h.form.elements.company_web_url.value='fake link';
  await h.form.events.submit({preventDefault(){}});
  assert.equal(h.calls.length,0);
  assert.match(h.nodes.get('order-status').textContent,/Не удалось обработать/);
});
