<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$SALVY_API_URL = "https://api.salvy.com.br/api/v2";
$path = isset($_GET['path']) ? trim((string)$_GET['path']) : '';

if ($path === '') {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => ["message" => "Parâmetro 'path' é obrigatório."]]);
    exit;
}

function read_salvy_secret_include($file_path) {
    if (!is_string($file_path) || $file_path === '' || !file_exists($file_path)) return '';
    $loaded = include $file_path;
    if (is_array($loaded) && !empty($loaded['SALVY_ACCESS_TOKEN'])) {
        return (string)$loaded['SALVY_ACCESS_TOKEN'];
    }
    if (is_string($loaded) && trim($loaded) !== '') {
        return (string)$loaded;
    }
    return '';
}

$SALVY_ACCESS_TOKEN = getenv('SALVY_ACCESS_TOKEN') ?: '';

if ($SALVY_ACCESS_TOKEN === '') {
    $secretsPhpPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'salvy-secrets.php';
    $SALVY_ACCESS_TOKEN = read_salvy_secret_include($secretsPhpPath);
}

if ($SALVY_ACCESS_TOKEN === '') {
    $secretsIniPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.salvy-secrets.ini';
    if (file_exists($secretsIniPath)) {
        $loadedIni = parse_ini_file($secretsIniPath, false, INI_SCANNER_RAW);
        if (is_array($loadedIni) && !empty($loadedIni['SALVY_ACCESS_TOKEN'])) {
            $SALVY_ACCESS_TOKEN = (string)$loadedIni['SALVY_ACCESS_TOKEN'];
        }
    }
}

if ($SALVY_ACCESS_TOKEN === '') {
    http_response_code(500);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "error" => [
            "message" => "SALVY_ACCESS_TOKEN não configurado no servidor."
        ]
    ]);
    exit;
}

$forward_query_params = $_GET;
unset($forward_query_params['path']);
$forward_query_string = http_build_query($forward_query_params);

$url = rtrim($SALVY_API_URL, '/') . '/' . ltrim($path, '/');
if ($forward_query_string !== '') {
    $url .= '?' . $forward_query_string;
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $SALVY_ACCESS_TOKEN,
    'Accept: application/json',
    'User-Agent: Worklivoo-Salvy-Proxy/1.0',
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($curl_error) {
    http_response_code(502);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "error" => [
            "message" => "Erro no proxy Salvy: " . $curl_error
        ]
    ]);
    exit;
}

http_response_code($http_code);
header("Content-Type: " . ($content_type ?: "application/json; charset=utf-8"));
echo $response;
?>
