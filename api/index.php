<?php
// ===== KHANYA API (PHP 8 + SQLite). Endpoints: ?r=products | order | quote | lead | admin =====
const ADMIN_PASSWORD = 'khanya-admin';   // CHANGE THIS before going live
const SEED_DEMO_DATA = true;             // true = fill empty orders/quotes/leads tables with dummy rows from data/demo.json. Set false for production.
header('Content-Type: application/json');
$db = new PDO('sqlite:' . __DIR__ . '/../database/khanya.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec(file_get_contents(__DIR__ . '/../database/schema.sql'));   // create tables if missing

// Seed products from data/products.json the first time only
if ($db->query('SELECT COUNT(*) FROM products')->fetchColumn() == 0) {
  $st = $db->prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?)');
  foreach (json_decode(file_get_contents(__DIR__ . '/../data/products.json'), true) as $p)
    $st->execute([$p['id'],$p['name'],$p['cat'],$p['price'],$p['cov'],json_encode($p['spaces']),json_encode($p['moods']),$p['desc']]);
}
if (SEED_DEMO_DATA) {
  $demo = json_decode(file_get_contents(__DIR__ . '/../data/demo.json'), true);
  $seed = function ($table, $cols) use ($db, $demo) {
    if ($db->query("SELECT COUNT(*) FROM $table")->fetchColumn() > 0) return;
    $st = $db->prepare("INSERT INTO $table(" . implode(',', $cols) . ") VALUES(" . implode(',', array_fill(0, count($cols), '?')) . ")");
    foreach ($demo[$table] as $row) $st->execute(array_map(fn($c) => is_array($row[$c] ?? '') ? json_encode($row[$c]) : ($row[$c] ?? ''), $cols));
  };
  $seed('orders', ['name','email','phone','address','notes','items','total','created']);
  $seed('quotes', ['name','email','phone','space','size','mood','location','install','estimate','details','created']);
  $seed('leads',  ['name','email','phone','message','created']);
}
$in = json_decode(file_get_contents('php://input'), true) ?? [];
$r  = $_GET['r'] ?? '';
$clean = fn($k) => trim(strip_tags((string)($in[$k] ?? '')));   // basic input sanitising

try {
  switch ($r) {
    case 'products':   // same shape as data/products.json
      $rows = $db->query('SELECT * FROM products')->fetchAll(PDO::FETCH_ASSOC);
      foreach ($rows as &$p) { $p['spaces']=json_decode($p['spaces']); $p['moods']=json_decode($p['moods']); $p['desc']=$p['descr']; unset($p['descr']); }
      echo json_encode($rows); break;
    case 'order':
      $db->prepare('INSERT INTO orders(name,email,phone,address,notes,items,total) VALUES(?,?,?,?,?,?,?)')
         ->execute([$clean('name'),$clean('email'),$clean('phone'),$clean('address'),$clean('notes'),json_encode($in['items']??[]),(float)($in['total']??0)]);
      echo json_encode(['ok'=>true,'ref'=>'KLS-'.$db->lastInsertId()]); break;
    case 'quote':
      $db->prepare('INSERT INTO quotes(name,email,phone,space,size,mood,location,install,estimate,details) VALUES(?,?,?,?,?,?,?,?,?,?)')
         ->execute([$clean('name'),$clean('email'),$clean('phone'),$clean('space'),(float)($in['size']??0),$clean('mood'),$clean('location'),(int)($in['install']??0),(float)($in['estimate']??0),json_encode($in['details']??[])]);
      echo json_encode(['ok'=>true,'ref'=>'Q-'.$db->lastInsertId()]); break;
    case 'lead':
      $db->prepare('INSERT INTO leads(name,email,phone,message) VALUES(?,?,?,?)')->execute([$clean('name'),$clean('email'),$clean('phone'),$clean('message')]);
      echo json_encode(['ok'=>true]); break;
    case 'admin':      // header "X-Admin: <password>" required
      if (($_SERVER['HTTP_X_ADMIN'] ?? '') !== ADMIN_PASSWORD) { http_response_code(401); echo json_encode(['error'=>'Incorrect password']); break; }
      $q = fn($t) => $db->query("SELECT * FROM $t ORDER BY id DESC LIMIT 50")->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(['orders'=>$q('orders'),'quotes'=>$q('quotes'),'leads'=>$q('leads'),'products'=>$q('products'),
        'revenue'=>(float)$db->query('SELECT COALESCE(SUM(total),0) FROM orders')->fetchColumn()]); break;
    default: http_response_code(404); echo json_encode(['error'=>'Not found']);
  }
} catch (Throwable $e) { error_log('[Khanya API] ' . $e->getMessage()); http_response_code(500); echo json_encode(['error'=>'Service unavailable']); }   // details go to the server error log (not shown to customers)
