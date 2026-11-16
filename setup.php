<?php
require 'config.php';
$pdo->exec("CREATE TABLE IF NOT EXISTS students (
  enrollment VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL
)");
$pdo->exec("CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Anonymous',
  roll VARCHAR(100) NULL,
  category VARCHAR(40) NOT NULL,
  meal VARCHAR(20) NOT NULL,
  incident_date DATE NOT NULL,
  rating TINYINT NULL,
  priority VARCHAR(10) NOT NULL,
  comment TEXT NOT NULL,
  suggestion VARCHAR(200) NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");
$pdo->exec("CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment VARCHAR(30) NULL,
  meal VARCHAR(20) NOT NULL,
  mood VARCHAR(10) NOT NULL,
  comment VARCHAR(200) NULL,
  notify VARCHAR(10) NOT NULL DEFAULT 'none',
  contact VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");
try { $pdo->exec("ALTER TABLE feedback ADD COLUMN enrollment VARCHAR(30) NULL"); } catch (Exception $e) { /* already there */ }

$n = 0;
$file = __DIR__ . '/students.csv';
if (is_readable($file)) {
  $f = fopen($file, 'r');
  fgetcsv($f, 0, ',', '"', '\\');
  $ins = $pdo->prepare("INSERT INTO students (enrollment,name,password_hash) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash)");
  while (($r = fgetcsv($f, 0, ',', '"', '\\')) !== false) {
    if (count($r) < 3 || trim($r[0]) === '') continue;
    $ins->execute([strtoupper(trim($r[0])), trim($r[1]), password_hash(trim($r[2]), PASSWORD_DEFAULT)]);
    $n++;
  }
  fclose($f);
}
echo "Tables ready. Students imported: $n. Now delete setup.php and students.csv from the server.";
