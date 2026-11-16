<?php
require 'config.php';
header('Content-Type: application/json');
function out($d, $c = 200) { http_response_code($c); echo json_encode($d); exit; }

$action = $_GET['action'] ?? '';
$admin = !empty($_SESSION['admin']);
$student = $_SESSION['student'] ?? null;
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$g = fn($k) => trim((string)($in[$k] ?? ''));
$norm = fn($s) => mb_strtolower(preg_replace('/\s+/', ' ', trim($s)));

if ($action === 'me') out(['student' => $student ? $student['name'] : null, 'admin' => $admin]);

/* ---- login / logout (no session needed) ---- */
if (in_array($action, ['student_login', 'login', 'logout'], true)) {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'POST required'], 405);
  if ($action === 'logout') { session_destroy(); out(['ok' => true]); }
  if (($_SESSION['lock'] ?? 0) > time()) out(['error' => 'Too many wrong attempts. Try again in a few minutes.'], 429);
  $pw = (string)($in['password'] ?? '');
  $ok = false; $row = null;
  if ($action === 'login') {
    $ok = hash_equals(ADMIN_PASSWORD, $pw);
  } else {
    $st = $pdo->prepare("SELECT enrollment, name, password_hash FROM students WHERE enrollment = ?");
    $st->execute([strtoupper($g('enrollment'))]);
    $row = $st->fetch();
    $ok = $row && $norm($row['name']) === $norm($g('name')) && password_verify($pw, $row['password_hash']);
  }
  if (!$ok) {
    $_SESSION['fails'] = ($_SESSION['fails'] ?? 0) + 1;
    if ($_SESSION['fails'] >= 5) { $_SESSION['lock'] = time() + 300; $_SESSION['fails'] = 0; }
    out(['error' => $action === 'login' ? 'Wrong password' : 'Details do not match university records'], 401);
  }
  session_regenerate_id(true);
  $_SESSION['fails'] = 0;
  if ($action === 'login') $_SESSION['admin'] = true;
  else $_SESSION['student'] = ['enrollment' => $row['enrollment'], 'name' => $row['name']];
  out(['ok' => true]);
}

/* ---- everything below needs a logged-in student or committee ---- */
if (!$admin && !$student) out(['error' => 'Please log in first'], 401);

if ($action === 'list') {
  $rows = $pdo->query("SELECT id,name,roll,category,meal,incident_date,rating,priority,comment,suggestion,status,created_at FROM complaints ORDER BY id DESC")->fetchAll();
  if (!$admin) $rows = array_map(function ($r) { unset($r['roll']); return $r; }, $rows);
  out(['admin' => $admin, 'complaints' => $rows]);
}

if ($action === 'stats') {
  out([
    'feedback' => $pdo->query("SELECT meal, mood, COUNT(*) n FROM feedback GROUP BY meal, mood")->fetchAll(),
    'status' => $pdo->query("SELECT status, COUNT(*) n FROM complaints GROUP BY status")->fetchAll(),
    'categories' => $pdo->query("SELECT category, COUNT(*) n FROM complaints GROUP BY category ORDER BY n DESC")->fetchAll()
  ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'POST required'], 405);

if ($action === 'add') {
  if (!$student) out(['error' => 'Student login required'], 403);
  $cats = ['Food quality', 'Hygiene', 'Staff', 'Queues and timings', 'Menu', 'Other'];
  $meals = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
  $pris = ['Low', 'Medium', 'High'];
  $date = $g('date'); $comment = $g('comment'); $rating = $g('rating');
  $d = DateTime::createFromFormat('Y-m-d', $date);
  if (!in_array($g('category'), $cats, true)) out(['error' => 'Choose a category'], 400);
  if (!in_array($g('meal'), $meals, true)) out(['error' => 'Choose a meal'], 400);
  if (!in_array($g('priority'), $pris, true)) out(['error' => 'Choose how serious it is'], 400);
  if (!$d || $d->format('Y-m-d') !== $date || $date > date('Y-m-d')) out(['error' => 'Enter a valid past date'], 400);
  if (mb_strlen($comment) < 15 || mb_strlen($comment) > 500) out(['error' => 'Description must be 15 to 500 characters'], 400);
  if ($rating !== '' && !in_array($rating, ['1', '2', '3', '4', '5'], true)) out(['error' => 'Invalid rating'], 400);
  $shownName = !empty($in['anonymous']) ? 'Anonymous' : $student['name'];
  $st = $pdo->prepare("INSERT INTO complaints (name,roll,category,meal,incident_date,rating,priority,comment,suggestion) VALUES (?,?,?,?,?,?,?,?,?)");
  $st->execute([
    $shownName, $student['enrollment'],
    $g('category'), $g('meal'), $date, $rating === '' ? null : (int)$rating,
    $g('priority'), $comment, mb_substr($g('suggestion'), 0, 200) ?: null
  ]);
  out(['ok' => true]);
}

if ($action === 'feedback') {
  if (!$student) out(['error' => 'Student login required'], 403);
  $meals = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
  $notify = $g('notify') ?: 'none'; $contact = $g('contact');
  if (!in_array($g('meal'), $meals, true)) out(['error' => 'Choose a meal'], 400);
  if (!in_array($g('mood'), ['Happy', 'Neutral', 'Sad'], true)) out(['error' => 'Tap a face'], 400);
  if (!in_array($notify, ['whatsapp', 'email', 'none'], true)) out(['error' => 'Invalid reminder choice'], 400);
  if ($notify === 'whatsapp' && !preg_match('/^\+?[0-9 \-]{10,15}$/', $contact)) out(['error' => 'Enter a valid WhatsApp number'], 400);
  if ($notify === 'email' && !filter_var($contact, FILTER_VALIDATE_EMAIL)) out(['error' => 'Enter a valid email'], 400);
  if ($notify === 'none') $contact = '';
  $dup = $pdo->prepare("SELECT 1 FROM feedback WHERE enrollment = ? AND meal = ? AND DATE(created_at) = CURDATE()");
  $dup->execute([$student['enrollment'], $g('meal')]);
  if ($dup->fetch()) out(['error' => 'You have already rated this meal today'], 400);
  $pdo->prepare("INSERT INTO feedback (enrollment,meal,mood,comment,notify,contact) VALUES (?,?,?,?,?,?)")
      ->execute([$student['enrollment'], $g('meal'), $g('mood'), mb_substr($g('comment'), 0, 200) ?: null, $notify, $contact ?: null]);
  out(['ok' => true]);
}

/* ---- committee only ---- */
if (!$admin) out(['error' => 'Committee login required'], 403);

if ($action === 'status') {
  $s = $g('status');
  if (!in_array($s, ['Open', 'Resolved'], true)) out(['error' => 'Invalid status'], 400);
  $pdo->prepare("UPDATE complaints SET status=? WHERE id=?")->execute([$s, (int)($in['id'] ?? 0)]);
  out(['ok' => true]);
}
if ($action === 'delete') {
  $pdo->prepare("DELETE FROM complaints WHERE id=?")->execute([(int)($in['id'] ?? 0)]);
  out(['ok' => true]);
}
out(['error' => 'Unknown action'], 400);
