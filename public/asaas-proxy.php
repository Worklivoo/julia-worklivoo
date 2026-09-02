<?php
// Proxy para API do Asaas (HostGator/cPanel)
// Salve este arquivo como asaas-proxy.php na pasta public (ou raiz do site)

// Configuração de CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, access_token, Authorization");

// Tratamento de Preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// URL Base do Asaas
$ASAAS_API_URL = "https://api.asaas.com/v3";

// Recuperar o path da requisição
$path = isset($_GET['path']) ? $_GET['path'] : '';

if (empty($path)) {
    http_response_code(400);
    echo json_encode(["error" => "Parâmetro 'path' é obrigatório."]);
    exit;
}

// Encaminhar query string (exceto "path") para a API do Asaas
$forward_query_params = $_GET;
unset($forward_query_params['path']);
unset($forward_query_params['debug']);
$forward_query_string = http_build_query($forward_query_params);

// Construir a URL final
$url = $ASAAS_API_URL . "/" . $path;
if (!empty($forward_query_string)) {
    $url .= (strpos($url, '?') !== false ? '&' : '?') . $forward_query_string;
}

// Inicializar cURL
$ch = curl_init($url);

// Recuperar Headers da requisição original
$request_headers = [];
// Não precisamos encaminhar o User-Agent do cliente, vamos definir um fixo no cURL
$headers_to_forward = ['access_token', 'content-type', 'authorization'];

// Função para pegar headers (compatibilidade Nginx/Apache)
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

function sanitize_asaas_token($value) {
    $v = trim((string)$value);
    $v = preg_replace('/^["\']|["\']$/', '', $v);
    $v = str_replace('\\$', '$', $v);
    $v = preg_replace('/\s+/', '', $v);
    return $v;
}

function mask_asaas_token($token) {
    $t = trim((string)$token);
    if (empty($t)) return '';
    $len = strlen($t);
    if ($len <= 12) {
        return substr($t, 0, 2) . '...' . substr($t, -2);
    }
    return substr($t, 0, 6) . '...' . substr($t, -4);
}

function get_request_id() {
    try {
        return bin2hex(random_bytes(6));
    } catch (Exception $e) {
        return uniqid('', true);
    }
}

function should_debug_asaas_proxy($incoming_headers) {
    $env_debug = getenv('ASAAS_DEBUG');
    if (!empty($env_debug) && strtolower(trim((string)$env_debug)) === 'true') return true;
    if (isset($_GET['debug']) && trim((string)$_GET['debug']) === '1') return true;
    foreach ($incoming_headers as $k => $v) {
        if (strtolower($k) === 'x-debug-asaas' && trim((string)$v) === '1') return true;
    }
    return false;
}

function asaas_proxy_log($request_id, $message, $context = null) {
    $line = '[AsaasProxy][' . $request_id . '] ' . $message;
    if (!is_null($context)) {
        $json = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json !== false) {
            $line .= ' ' . $json;
        }
    }
    error_log($line);
}

function read_asaas_token_from_include($file_path) {
    if (!is_string($file_path) || empty($file_path)) return '';
    if (!file_exists($file_path)) return '';
    $value = include $file_path;
    if (is_string($value) && !empty(trim($value))) return (string)$value;
    if (defined('ASAAS_API_KEY') && !empty((string)constant('ASAAS_API_KEY'))) return (string)constant('ASAAS_API_KEY');
    return '';
}

$request_id = get_request_id();
header('X-Asaas-Proxy-Request-Id: ' . $request_id);
$debug_enabled = should_debug_asaas_proxy($incoming_headers);
if ($debug_enabled) {
    asaas_proxy_log($request_id, 'request', [
        'method' => $_SERVER['REQUEST_METHOD'],
        'path' => $path,
        'remote' => $_SERVER['REMOTE_ADDR'] ?? '',
        'host' => $_SERVER['HTTP_HOST'] ?? '',
        'uri' => $_SERVER['REQUEST_URI'] ?? '',
        'origin' => $_SERVER['HTTP_ORIGIN'] ?? '',
        'referer' => $_SERVER['HTTP_REFERER'] ?? '',
    ]);
}

$has_access_token = false;
foreach ($incoming_headers as $key => $value) {
    if (in_array(strtolower($key), $headers_to_forward)) {
        if (strtolower($key) === 'access_token') {
            $has_access_token = true;
        }
        $request_headers[] = "$key: $value";
    }
}

if ($debug_enabled) {
    asaas_proxy_log($request_id, 'incoming headers (filtered)', [
        'has_access_token' => $has_access_token,
        'forwarded' => $headers_to_forward,
    ]);
}

if (!$has_access_token) {
    $token_source = '';
    $server_token =
        getenv('ASAAS_API_KEY') ? getenv('ASAAS_API_KEY') :
        (getenv('VITE_ASAAS_API_KEY') ? getenv('VITE_ASAAS_API_KEY') :
        (isset($_SERVER['ASAAS_API_KEY']) ? $_SERVER['ASAAS_API_KEY'] :
        (isset($_SERVER['VITE_ASAAS_API_KEY']) ? $_SERVER['VITE_ASAAS_API_KEY'] : '')));

    if (!empty($server_token)) {
        if (getenv('ASAAS_API_KEY')) $token_source = 'env:ASAAS_API_KEY';
        else if (getenv('VITE_ASAAS_API_KEY')) $token_source = 'env:VITE_ASAAS_API_KEY';
        else if (isset($_SERVER['ASAAS_API_KEY'])) $token_source = 'server:ASAAS_API_KEY';
        else if (isset($_SERVER['VITE_ASAAS_API_KEY'])) $token_source = 'server:VITE_ASAAS_API_KEY';
    }

    if (empty($server_token)) {
        $base_dir = dirname(__DIR__);
        $server_token = read_asaas_token_from_include($base_dir . '/asaas-secret.php');
        if (empty($server_token)) {
            $server_token = read_asaas_token_from_include($base_dir . '/private/asaas-secret.php');
            if (!empty($server_token)) $token_source = 'include:' . $base_dir . '/private/asaas-secret.php';
        } else {
            $token_source = 'include:' . $base_dir . '/asaas-secret.php';
        }
    }

    $server_token = sanitize_asaas_token($server_token);
    if (!empty($server_token)) {
        header('X-Asaas-Proxy-Token-Source: ' . $token_source);
        if ($debug_enabled) {
            asaas_proxy_log($request_id, 'token resolved', [
                'source' => $token_source,
                'masked' => mask_asaas_token($server_token),
            ]);
        }
        $request_headers[] = "access_token: " . $server_token;
    } else {
        http_response_code(500);
        if ($debug_enabled) {
            asaas_proxy_log($request_id, 'token missing');
        }
        echo json_encode([
            "error" => "ASAAS_API_KEY is missing on server",
            "checked" => [
                "env:ASAAS_API_KEY",
                "env:VITE_ASAAS_API_KEY",
                "server:ASAAS_API_KEY",
                "server:VITE_ASAAS_API_KEY",
                "include:" . dirname(__DIR__) . "/asaas-secret.php",
                "include:" . dirname(__DIR__) . "/private/asaas-secret.php"
            ]
        ]);
        exit;
    }
} else {
    header('X-Asaas-Proxy-Token-Source: header:access_token');
    if ($debug_enabled) {
        $header_token = '';
        foreach ($incoming_headers as $k => $v) {
            if (strtolower($k) === 'access_token') {
                $header_token = sanitize_asaas_token($v);
                break;
            }
        }
        asaas_proxy_log($request_id, 'token from header', [
            'masked' => mask_asaas_token($header_token),
        ]);
    }
}

// Adicionar User-Agent falso para simular navegador (evita bloqueio WAF)
$request_headers[] = "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Configurar opções do cURL
curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

// Remover CURLOPT_USERAGENT pois já estamos enviando no header
// curl_setopt($ch, CURLOPT_USERAGENT, '...');

// Configurar Método HTTP
$method = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

if ($debug_enabled) {
    asaas_proxy_log($request_id, 'forward', [
        'url' => $url,
        'method' => $method,
    ]);
}

// Configurar Body (se houver)
if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    $input = file_get_contents('php://input');
    if ($debug_enabled) {
        $len = strlen((string)$input);
        asaas_proxy_log($request_id, 'body', [ 'bytes' => $len ]);
    }
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

// Executar requisição
$started_at = microtime(true);
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
$elapsed_ms = (int)round((microtime(true) - $started_at) * 1000);

curl_close($ch);

// Retornar resposta
http_response_code($http_code);

if ($curl_error) {
    if ($debug_enabled) {
        asaas_proxy_log($request_id, 'curl error', [ 'error' => $curl_error, 'ms' => $elapsed_ms ]);
    }
    echo json_encode(["error" => "Erro no Proxy cURL: $curl_error"]);
} else {
    if ($debug_enabled) {
        $size = strlen((string)$response);
        $preview = substr((string)$response, 0, 220);
        asaas_proxy_log($request_id, 'upstream response', [
            'status' => $http_code,
            'ms' => $elapsed_ms,
            'bytes' => $size,
            'preview' => $preview,
        ]);
    }
    echo $response;
}
?>
