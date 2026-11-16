/* ===== KHANYA LED SOLUTION – front-end app (vanilla JS, no build step) =====
   Debug tips: open browser DevTools (F12) > Console. Every API failure is logged with "[API]". */
const $ = s => document.querySelector(s);
const R = n => 'R ' + Math.round(n).toLocaleString('en-ZA');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let products = [];
let cart = JSON.parse(localStorage.getItem('khanyaCart') || '[]');   // [{id, qty}]
const filt = {q:'', cat:'', max:''};                                   // catalogue filters
const S = {step:1, space:'', size:'', mood:'', install:null, loc:'', result:null}; // Quotation Studio state

/* ---------- API helper: talks to api/index.php, falls back to data/products.json ---------- */
async function api(route, body, headers = {}) {
  try {
    const r = await fetch('api/index.php?r=' + route, body ? {method:'POST', body:JSON.stringify(body), headers} : {headers});
    const j = await r.json(); if (!r.ok) { const er = new Error(j.error || r.status); er.status = r.status; throw er; } return j;
  } catch (e) { console.error('[API]', route, e); throw e; }
}
async function loadProducts() {
  try { products = await api('products'); }
  catch { products = DUMMY.products; }  // dummy catalogue when the server is not available
}

/* ---------- demo mode: when the server is unreachable, submissions are kept in this browser and the admin shows dummy data ---------- */
const LOCAL_KEY = 'khanyaLocal', DEMO_ADMIN_PASSWORD = 'khanya-admin';   // keep in sync with ADMIN_PASSWORD in api/index.php
const local = () => JSON.parse(localStorage.getItem(LOCAL_KEY) || '{"orders":[],"quotes":[],"leads":[]}');
async function submit(kind, route, body) {
  try { return await api(route, body); }
  catch (e) { const L = local(), n = 1000 + L[kind].length + 1;
    L[kind].unshift({id:n, ...body, created:new Date().toISOString().slice(0,16).replace('T',' ')}); localStorage.setItem(LOCAL_KEY, JSON.stringify(L));
    return {ok:true, ref:({orders:'KLS-',quotes:'Q-',leads:'L-'})[kind] + n}; }
}
async function loadAdmin(pw) {
  const bad = () => Object.assign(new Error('Incorrect password. Please try again.'), {safe:true});
  try { return await api('admin', null, {'X-Admin': pw}); }
  catch (e) { if (e.status == 401 || pw !== DEMO_ADMIN_PASSWORD) throw bad();
    const L = local(), m = k => [...L[k], ...DUMMY[k]];
    return {orders:m('orders'), quotes:m('quotes'), leads:m('leads'), products:DUMMY.products, revenue:m('orders').reduce((a,o) => a + (+o.total || 0), 0)}; }
}

/* ---------- cart ---------- */
const saveCart = () => { localStorage.setItem('khanyaCart', JSON.stringify(cart)); $('#cartCount').textContent = cart.reduce((a,c) => a + c.qty, 0); };
const addToCart = (id, qty = 1) => { const l = cart.find(c => c.id == id); l ? l.qty += qty : cart.push({id:+id, qty}); saveCart(); };
const cartLines = () => cart.map(c => ({...products.find(p => p.id == c.id), qty:c.qty})).filter(l => l.id);
const cartTotal = () => cartLines().reduce((a,l) => a + l.price * l.qty, 0);

/* ---------- Quotation Studio estimate logic (edit prices here) ---------- */
const SPACES = ['Home','Office','Store','Mall','Club','Warehouse'];
const MOODS  = ['Luxury','Warm & Cozy','Bright & Clean','Modern','Party Atmosphere'];
const INSTALL_PER_FITTING = 150;   // rand per fitting
const CALLOUT = {near:450, far:1200};  // call-out fee: Gauteng vs elsewhere
function buildQuote() {
  const area = +S.size;
  // 1) score products: space match + mood match (mood weighted higher)
  const ranked = products.map(p => ({p, score:(p.spaces.includes(S.space)?1:0) + (p.moods.includes(S.mood)?2:0)}))
    .filter(x => x.score >= 3).sort((a,b) => b.score - a.score || b.p.cov - a.p.cov);  // needs space AND mood match; wide-coverage lead product first
  const picked = [], cats = new Set();
  for (const x of ranked) { if (!cats.has(x.p.cat) && picked.length < 3) { cats.add(x.p.cat); picked.push(x.p); } }
  // 2) quantity per product = area / coverage; lead product covers 100%, extras cover 25% (accent lighting)
  const lines = picked.map((p,i) => ({...p, qty: Math.max(1, Math.ceil(area * (i ? .25 : 1) / p.cov))}));
  const parts = lines.reduce((a,l) => a + l.price * l.qty, 0);
  const fittings = lines.reduce((a,l) => a + l.qty, 0);
  const gauteng = /johannesburg|sandton|pretoria|midrand|centurion|soweto|randburg|roodepoort|gauteng|benoni|boksburg/i.test(S.loc);
  const install = S.install ? fittings * INSTALL_PER_FITTING + (gauteng ? CALLOUT.near : CALLOUT.far) : 0;
  const bundleDiscount = lines.length > 1 ? parts * .05 : 0;          // 5% bundle saving
  return {lines, parts, install, bundleDiscount, total: parts - bundleDiscount + install};
}

/* ---------- small view helpers ---------- */
const bulb = '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><path d="M32 6a16 16 0 0 0-8 30v8h16v-8a16 16 0 0 0-8-30zM26 52h12M28 58h8"/></svg>';
const hue = c => ([...new Set(products.map(p => p.cat))].indexOf(c) * 47 + 255) % 360;  // colour per category
const productCard = p => `<article class="card"><a href="#/product/${p.id}"><div class="thumb" style="--h:${hue(p.cat)}">${bulb}</div></a><p class="tag">${esc(p.cat)}</p>
  <h3 style="font-size:1rem"><a href="#/product/${p.id}">${esc(p.name)}</a></h3><p class="price">${R(p.price)}</p><p class="stock">In stock · ships from our warehouse</p>
  <button class="btn sm fill" data-act="add" data-id="${p.id}">Add to cart</button></article>`;
const field = (id, label, type='text', req=true) => `<label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" ${req?'required':''}>`;
const d0 = f => new FormData(f).get('q');
const formData = f => Object.fromEntries(new FormData(f));

/* ---------- VIEWS (one function per page; return HTML strings) ---------- */
const V = {};
V.home = () => `
<section class="hero"><div class="split"><div><h1>Bright ideas for <span class="grad">every space</span></h1>
  <p>Shop LED lighting online, or tell us about your space and get an instant installation estimate. Homes, offices, clubs and warehouses.</p>
  <a class="btn fill" href="#/shop">Shop now</a><a class="btn" href="#/studio">Get an estimate</a></div>
  <div class="logo-card"><img src="assets/logo-crop.png" alt="Khanya LED Solution logo"></div></div></section>
<div class="trust"><div><b>Free delivery</b>On orders over R1 500</div><div><b>Installation</b>Done by our own team</div><div><b>Warranty</b>On all LED products</div><div><b>WhatsApp support</b>Quick answers</div></div>
<section class="wrap"><h2>Shop by category</h2><div class="grid">${[...new Set(products.map(p=>p.cat))].map(c =>
  `<a class="tile" style="--h:${hue(c)}" href="#/shop" data-act="cat" data-cat="${esc(c)}">${esc(c)}<small>${products.filter(p=>p.cat==c).length} products</small></a>`).join('')}</div></section>
<section class="wrap" style="padding-top:0"><h2>Popular right now</h2><div class="grid">${products.slice(0,8).map(productCard).join('')}</div></section>
<section class="wrap" style="padding-top:0"><div class="banner"><h2>Not sure what you need?</h2><p>Tell us the space, size and mood. We suggest the lights and the install cost.</p>
  <div><a class="btn" href="#/studio">Open Quotation Studio</a></div></div></section>
<section class="wrap"><h2>Recent projects</h2><div class="grid">
  <div class="card"><h3>Sandton nightclub</h3><p class="muted">220 m² dance floor with RGBW wash bars and strip lighting.</p></div>
  <div class="card"><h3>Midrand warehouse</h3><p class="muted">48 high bay fittings replaced old metal halide lamps.</p></div>
  <div class="card"><h3>Pretoria boutique</h3><p class="muted">Track spots with high-CRI beams for clothing displays.</p></div></div></section>
<section class="wrap" style="padding-top:0"><h2>What customers say</h2><div class="grid">
  <blockquote class="card quote">"Quote on WhatsApp, installed the next week. The club looks incredible." <p class="tag">Thabo M., club owner, Sandton</p></blockquote>
  <blockquote class="card quote">"Our electricity bill dropped noticeably after the warehouse upgrade." <p class="tag">Priya N., operations, Midrand</p></blockquote>
  <blockquote class="card quote">"The estimate was within 5% of the final quote." <p class="tag">Johan V., developer, Centurion</p></blockquote></div></section>
<section class="wrap" style="padding-top:0"><h2>Got a question?</h2><p class="muted">Delivery, installation, warranty and quotes are answered on our <a href="#/queries"><u>Queries page</u></a>.</p></section>`;

V.shop = () => {
  const cats = [...new Set(products.map(p => p.cat))];
  const list = products.filter(p => (!filt.cat || p.cat == filt.cat) && (!filt.max || p.price <= +filt.max) && p.name.toLowerCase().includes(filt.q.toLowerCase()));
  return `<div class="wrap"><h2>Shop</h2><div class="filters" role="search">
    <input id="fq" placeholder="Search products" aria-label="Search products" value="${esc(filt.q)}">
    <select id="fc" aria-label="Category"><option value="">All categories</option>${cats.map(c=>`<option ${filt.cat==c?'selected':''}>${esc(c)}</option>`).join('')}</select>
    <select id="fm" aria-label="Maximum price"><option value="">Any price</option>${[200,500,1000,2500].map(v=>`<option value="${v}" ${filt.max==v?'selected':''}>Up to ${R(v)}</option>`).join('')}</select></div>
    <div class="grid" id="plist">${list.map(productCard).join('') || '<p class="muted">No products match. Clear a filter to see more.</p>'}</div></div>`;
};
V.product = id => { const p = products.find(x => x.id == id); if (!p) return '<div class="wrap"><h2>Product not found</h2><a class="btn" href="#/shop">Back to shop</a></div>';
  return `<div class="wrap split"><div class="thumb" style="height:320px">${bulb}</div><div><p class="tag">${esc(p.cat)}</p><h2>${esc(p.name)}</h2>
  <p class="price" style="font-size:1.6rem">${R(p.price)}</p><p>${esc(p.desc)}</p><p class="muted">Suited to: ${p.spaces.join(', ')}</p>
  <button class="btn fill" data-act="add" data-id="${p.id}">Add to cart</button></div></div>`; };

V.cart = () => { const L = cartLines(); if (!L.length) return '<div class="wrap"><h2>Your cart is empty</h2><a class="btn fill" href="#/shop">Browse products</a></div>';
  return `<div class="wrap"><h2>Cart</h2><table><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr>${L.map(l => `<tr><td>${esc(l.name)}</td><td>${R(l.price)}</td>
  <td><input type="number" min="1" value="${l.qty}" style="width:70px" data-act="qty" data-id="${l.id}" aria-label="Quantity for ${esc(l.name)}"></td><td>${R(l.price*l.qty)}</td>
  <td><button class="btn sm" data-act="rm" data-id="${l.id}">Remove</button></td></tr>`).join('')}</table>
  <p class="total">Total ${R(cartTotal())}</p><a class="btn fill" href="#/checkout">Checkout</a></div>`; };

V.checkout = () => `<div class="wrap" style="max-width:640px"><h2>Checkout</h2><p class="muted">Demo checkout: no payment is taken. We confirm your order by phone or WhatsApp.</p>
  <form id="coForm">${field('name','Full name')}${field('email','Email','email')}${field('phone','Contact number','tel')}${field('address','Delivery address')}
  <label for="notes">Order notes</label><textarea id="notes" name="notes" rows="3"></textarea>
  <p class="total">${R(cartTotal())}</p><button class="btn fill">Place order</button></form><div id="out"></div></div>`;

V.about = () => `<div class="wrap" style="max-width:760px"><h2>About Khanya LED Solution</h2>
  <p>Khanya started with word of mouth and WhatsApp messages: people asking for better lighting and someone they could trust to fit it. We now supply and install LED lighting for homes and businesses from our warehouse.</p>
  <h3>Mission</h3><p>Make good lighting simple to choose, fairly priced and properly installed.</p>
  <h3>Services</h3><p>Product supply, project quotations, installation and retrofits, and lighting design for clubs, stores, offices and warehouses.</p>
  <h3>Why customers trust us</h3><p>Clear quotes, genuine products with warranty and one team from order to installation.</p></div>`;

V.contact = () => `<div class="wrap split"><div><h2>Contact us</h2><p>Email: <a href="mailto:info@khanyaled.co.za">info@khanyaled.co.za</a></p>
  <p><a class="btn fill" href="https://wa.me/27000000000">Chat on WhatsApp</a></p><h3>Service areas</h3><p class="muted">Johannesburg, Sandton, Pretoria, Midrand, Centurion, East Rand. Delivery nationwide.</p></div>
  <form id="ctForm">${field('name','Name')}${field('email','Email','email')}${field('phone','Phone','tel',false)}<label for="message">How can we help?</label><textarea id="message" name="message" rows="4" required></textarea>
  <button class="btn fill">Send message</button><div id="out"></div></form></div>`;

/* Quotation Studio: 5 wizard screens, each screen = one step */
V.studio = () => {
  const bar = `<div class="steps">${[1,2,3,4,5,6].map(i=>`<i class="${i<=S.step?'on':''}"></i>`).join('')}</div>`;
  const opts = (list, key) => `<div class="opts">${list.map(o=>`<button class="opt" data-act="pick" data-key="${key}" data-v="${esc(o)}" aria-pressed="${S[key]==o}">${esc(o)}</button>`).join('')}</div>`;
  const nav = (ok) => `<p>${S.step>1?'<button class="btn" data-act="back">Back</button>':''}<button class="btn fill" data-act="next" ${ok?'':'disabled'}>Continue</button></p>`;
  let h = '';
  if (S.step==1) h = `<h2>What are we lighting?</h2>${opts(SPACES,'space')}${nav(S.space)}`;
  if (S.step==2) h = `<h2>How big is the space?</h2>${field('size','Size in m²','number')}${field('loc','Location (suburb or city)','text')}${nav(true)}`;
  if (S.step==3) h = `<h2>Choose the atmosphere</h2>${opts(MOODS,'mood')}${nav(S.mood)}`;
  if (S.step==4) h = `<h2>Do you need installation?</h2><div class="opts">${[['Yes, install it',1],['No, supply only',0]].map(([t,v])=>`<button class="opt" data-act="pick" data-key="install" data-v="${v}" aria-pressed="${S.install===v}">${t}</button>`).join('')}</div>${nav(S.install!==null)}`;
  if (S.step==5) { const q = S.result = buildQuote();
    h = `<h2>Your estimate</h2><p class="muted">${esc(S.space)} · ${S.size} m² · ${esc(S.mood)} · ${esc(S.loc||'location not given')}</p>
    <table><tr><th>Product</th><th>Qty</th><th>Cost</th></tr>${q.lines.map(l=>`<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${R(l.price*l.qty)}</td></tr>`).join('')}
    <tr><td>Bundle saving (5%)</td><td></td><td>-${R(q.bundleDiscount)}</td></tr><tr><td>Installation</td><td></td><td>${S.install?R(q.install):'Not required'}</td></tr></table>
    <p class="total">Estimated total ${R(q.total)}</p><p class="muted">This is an estimate only. Request a final quotation to confirm.</p>
    <p><button class="btn" data-act="back">Back</button><button class="btn" data-act="addbundle">Add bundle to cart</button><button class="btn fill" data-act="next">Request final quote</button></p>`; }
  if (S.step==6) h = `<h2>Request your final quotation</h2><form id="qForm">${field('name','Name')}${field('email','Email','email')}${field('phone','Phone','tel')}<button class="btn fill">Send quote request</button></form><div id="out"></div>`;
  return `<div class="wrap" style="max-width:760px"><h1 style="font-size:2rem">Quotation Studio</h1>${bar}${h}</div>`;
};

/* Queries: FAQ (edit FAQS to change answers) + ask-a-question form saved as a lead */
const FAQS = [
 ['How accurate is the Quotation Studio estimate?','It is an estimate based on your space, mood and location. We confirm the final price in a formal quotation.'],
 ['Do you install the lights?','Yes. Tick "Yes, install it" in the Quotation Studio and the installation cost is included in your estimate.'],
 ['Which areas do you service?','Johannesburg, Sandton, Pretoria, Midrand, Centurion and the East Rand. We deliver nationwide.'],
 ['How long does delivery take?','Gauteng orders usually arrive in 1 to 3 working days. Other provinces take 3 to 5 working days.'],
 ['Is there a warranty?','LED products carry a manufacturer warranty. Keep your order reference as proof of purchase.'],
 ['Can I pay online?','Checkout is a demo for now. We confirm your order and send payment details by WhatsApp or email.']];
V.queries = () => `<div class="wrap split" style="align-items:start"><div><h2>Queries</h2>${FAQS.map(f=>`<details><summary>${esc(f[0])}</summary><p class="muted">${esc(f[1])}</p></details>`).join('')}</div>
  <form id="qyForm" class="card"><h3>Ask us a question</h3>${field('name','Name')}${field('email','Email','email')}${field('phone','Phone (optional)','tel',false)}
  <label for="message">Your question</label><textarea id="message" name="message" rows="4" required></textarea><button class="btn fill">Send question</button><div id="out"></div></form></div>`;

/* Admin: password is checked by api/index.php (ADMIN_PASSWORD) */
V.admin = () => `<div class="wrap"><h2>Admin dashboard</h2><form id="adForm" style="max-width:340px"><label for="pw">Admin password</label><input id="pw" type="password" required><button class="btn fill">Sign in</button></form><div id="out"></div></div>`;
const adminTable = (t, rows, cols) => `<h3>${t} (${rows.length})</h3><div style="overflow:auto"><table><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</table></div>`;

/* ---------- router ---------- */
async function route() {
  const [, name = 'home', arg] = location.hash.replace('#','').split('/');
  const view = V[name || 'home'] || V.home;
  $('#app').innerHTML = view(arg); window.scrollTo(0,0);
  document.querySelectorAll('.top nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') == '#/' + name));
}

/* ---------- events (one delegated click handler keeps code easy to follow) ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const a = t.dataset.act, id = t.dataset.id;
  if (a=='add') { addToCart(id); t.textContent = 'Added'; }
  if (a=='rm') { cart = cart.filter(c => c.id != id); saveCart(); route(); }
  if (a=='cat') { filt.cat = t.dataset.cat; }
  if (a=='pick') { S[t.dataset.key] = t.dataset.key=='install' ? +t.dataset.v : t.dataset.v; route(); }
  if (a=='next') { if (S.step==2) { S.size = $('#size').value; S.loc = $('#loc').value; if (!(+S.size>0)) { $('#size').focus(); return; } } S.step++; route(); }
  if (a=='back') { S.step--; route(); }
  if (a=='addbundle') { S.result.lines.forEach(l => addToCart(l.id, l.qty)); location.hash = '#/cart'; }
});
document.addEventListener('change', e => { if (e.target.dataset.act=='qty') { const l = cart.find(c => c.id == e.target.dataset.id); l.qty = Math.max(1, +e.target.value); saveCart(); route(); }
  if (e.target.id=='fc') { filt.cat = e.target.value; route(); } if (e.target.id=='fm') { filt.max = e.target.value; route(); } });
document.addEventListener('input', e => { if (e.target.id=='fq') { filt.q = e.target.value; const pos = e.target.selectionStart; route(); const f=$('#fq'); f.focus(); f.setSelectionRange(pos,pos); } });
document.addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id=='hsForm') { filt.q = d0(e.target); filt.cat=''; filt.max=''; location.hash='#/shop'; route(); return; }
  const id = e.target.id, out = $('#out'), d = formData(e.target);
  const done = (m, ok=true) => out.innerHTML = `<p class="msg ${ok?'':'err'}" role="status">${m}</p>`;
  try {
    if (id=='coForm') { const r = await submit('orders','order', {...d, items:cartLines().map(l=>({id:l.id,name:l.name,qty:l.qty})), total:cartTotal()}); cart=[]; saveCart(); e.target.remove(); done(`Order received. Reference ${r.ref}. We will contact you to confirm.`); }
    if (id=='qyForm') { await submit('leads','lead', {...d, message:'[Query] '+d.message}); e.target.reset(); done('Question sent. We reply within one working day.'); }
    if (id=='ctForm') { await submit('leads','lead', d); e.target.reset(); done('Message sent. We reply within one working day.'); }
    if (id=='qForm') { const q = S.result; const r = await submit('quotes','quote', {...d, space:S.space, size:S.size, mood:S.mood, location:S.loc, install:S.install, estimate:q.total, details:q.lines.map(l=>({id:l.id,name:l.name,qty:l.qty}))}); e.target.remove(); done(`Quote request sent. Reference ${r.ref}. Our team will confirm the final price.`); }
    if (id=='adForm') { const D = await loadAdmin($('#pw').value); e.target.remove();
      out.innerHTML = `<div class="grid"><div class="card"><p class="muted">Orders</p><p class="total">${D.orders.length}</p></div><div class="card"><p class="muted">Quote requests</p><p class="total">${D.quotes.length}</p></div>
      <div class="card"><p class="muted">Leads</p><p class="total">${D.leads.length}</p></div><div class="card"><p class="muted">Revenue</p><p class="total">${R(D.revenue)}</p></div></div>`
      + adminTable('Orders', D.orders, ['id','name','phone','total','created']) + adminTable('Quote requests', D.quotes, ['id','name','space','size','estimate','created'])
      + adminTable('Customer leads', D.leads, ['id','name','email','message']) + adminTable('Products', D.products, ['id','name','cat','price']); }
  } catch (err) { console.error('[submit]', err); done(err.safe ? err.message : "We couldn't complete that just now. Please try again, or message us on WhatsApp and we will help.", false); }
});
window.addEventListener('hashchange', route);
loadProducts().then(() => { saveCart(); route(); });
