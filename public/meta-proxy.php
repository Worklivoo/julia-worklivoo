<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, file_offset");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

$GRAPH_API_URL = "https://graph.facebook.com";
$requestId = substr(bin2hex(random_bytes(8)), 0, 12);
header("x-meta-proxy-request-id: " . $requestId);

$META_ACCESS_TOKEN = getenv('META_ACCESS_TOKEN') ?: '';
$META_APP_ID = getenv('META_APP_ID') ?: '';

$secrets = null;
$secretsSource = 'env';
$secretsPhpPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'meta-secrets.php';
if (file_exists($secretsPhpPath)) {
    $loaded = include $secretsPhpPath;
    if (is_array($loaded)) {
        $secrets = $loaded;
        $secretsSource = 'php';
    }
}

if ($secrets === null) {
    $secretsIniPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.meta-secrets.ini';
    if (file_exists($secretsIniPath)) {
        $loadedIni = parse_ini_file($secretsIniPath, false, INI_SCANNER_RAW);
        if (is_array($loadedIni)) {
            $secrets = $loadedIni;
            $secretsSource = 'ini';
        }
    }
}

if (empty($META_ACCESS_TOKEN) && is_array($secrets) && !empty($secrets['META_ACCESS_TOKEN'])) {
    $META_ACCESS_TOKEN = $secrets['META_ACCESS_TOKEN'];
}
if (empty($META_APP_ID) && is_array($secrets) && !empty($secrets['META_APP_ID'])) {
    $META_APP_ID = $secrets['META_APP_ID'];
}

$hasToken = !empty($META_ACCESS_TOKEN);
$hasAppId = !empty($META_APP_ID);

$path = isset($_GET['path']) ? $_GET['path'] : '';
if (empty($path)) {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => ["message" => "Parâmetro 'path' é obrigatório."]]);
    exit;
}

$isUploadSessionStart = preg_match('~^v\d+\.\d+/uploads$~', $path) === 1;
if (!$hasToken) {
    http_response_code(500);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => ["message" => "META_ACCESS_TOKEN não configurado no servidor."]]);
    exit;
}

$isUploadBinary = strpos($path, '/upload:') !== false || preg_match('~^v\d+\.\d+/upload:~', $path) === 1;

if ($isUploadSessionStart) {
    if (!$hasAppId) {
        http_response_code(500);
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode(["error" => ["message" => "META_APP_ID não configurado no servidor."]]);
        exit;
    }
    $parts = explode('/', $path);
    $version = $parts[0];
    $path = $version . '/' . $META_APP_ID . '/uploads';
}

$forward_query_params = $_GET;
unset($forward_query_params['path']);
unset($forward_query_params['debug']);

if (strpos($path, '?') !== false) {
    $parts = explode('?', $path, 2);
    $path = $parts[0];
    $embeddedQuery = $parts[1];
    $embeddedParams = [];
    parse_str($embeddedQuery, $embeddedParams);
    if (is_array($embeddedParams)) {
        foreach ($embeddedParams as $k => $v) {
            if (!isset($forward_query_params[$k])) {
                $forward_query_params[$k] = $v;
            }
        }
    }
}

if ($isUploadSessionStart && $hasToken && !isset($forward_query_params['access_token'])) {
    $forward_query_params['access_token'] = $META_ACCESS_TOKEN;
}

$forward_query_string = http_build_query($forward_query_params);

$url = $GRAPH_API_URL . "/" . $path;
if (!empty($forward_query_string)) {
    $url .= (strpos($url, '?') !== false ? '&' : '?') . $forward_query_string;
}

$ch = curl_init($url);

$request_headers = [];
$headers_to_forward = ['content-type', 'file_offset'];

if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

$incoming_headers = getallheaders();
foreach ($incoming_headers as $key => $value) {
    if (in_array(strtolower($key), $headers_to_forward)) {
        $request_headers[] = "$key: $value";
    }
}

if ($hasToken) {
    if ($isUploadBinary) {
        $request_headers[] = "Authorization: OAuth " . $META_ACCESS_TOKEN;
    } else {
        $request_headers[] = "Authorization: Bearer " . $META_ACCESS_TOKEN;
    }
}

$request_headers[] = "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$method = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$upstream_content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curl_error = curl_error($ch);

curl_close($ch);

http_response_code($http_code);

if ($curl_error) {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => ["message" => "Erro no Proxy cURL: $curl_error"]]);
} else {
    if (!empty($upstream_content_type)) {
        header("Content-Type: " . $upstream_content_type);
    } else {
        header("Content-Type: application/json; charset=utf-8");
    }
    echo $response;
}
?>
