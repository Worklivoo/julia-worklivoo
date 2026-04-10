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

foreach ($incoming_headers as $key => $value) {
    if (in_array(strtolower($key), $headers_to_forward)) {
        $request_headers[] = "$key: $value";
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

// Configurar Body (se houver)
if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

// Executar requisição
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);

curl_close($ch);

// Retornar resposta
http_response_code($http_code);

if ($curl_error) {
    echo json_encode(["error" => "Erro no Proxy cURL: $curl_error"]);
} else {
    echo $response;
}
?>
