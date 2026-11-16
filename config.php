<?php
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();
$DB_HOST = 'sqlXXX.infinityfree.com';   // from InfinityFree > MySQL Databases
$DB_NAME = 'if0_XXXXXXXX_mess';
$DB_USER = 'if0_XXXXXXXX';
$DB_PASS = 'your-db-password';
const ADMIN_PASSWORD = 'change-me-123';  // committee login password

try {
  $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
  ]);
} catch (Exception $e) {
  http_response_code(500);
  header('Content-Type: application/json');
  echo json_encode(['error' => 'Database connection failed. Check config.php']);
  exit;
}
