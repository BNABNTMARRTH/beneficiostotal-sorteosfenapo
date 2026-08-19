<?php
/**
 * Puente Transparente de beneficiostotal.com/api/ hacia Node.js local (puerto 3001)
 */
$requestUri = $_SERVER['REQUEST_URI'] ?? '/api';
$tunnelUrl = 'https://pics-reputation-trackback-neural.trycloudflare.com';
$nodeUrl = $tunnelUrl . $requestUri;

$ch = curl_init($nodeUrl);

// Método HTTP (GET, POST, OPTIONS, etc.)
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD'] ?? 'GET');

// Copiar cabeceras entrantes
$headers = [];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $key => $value) {
        if (strtolower($key) !== 'host' && strtolower($key) !== 'content-length') {
            $headers[] = "$key: $value";
        }
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Pasar body para POST/PUT
$input = file_get_contents('php://input');
if (!empty($input)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);

if (curl_errno($ch)) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'El backend de Node.js no está respondiendo en el servidor local.']);
    curl_close($ch);
    exit;
}

$headerSize = curl_getinfo($ch, 2097163); // CURLINFO_HEADER_SIZE
$httpCode = curl_getinfo($ch, 2097154); // CURLINFO_HTTPCODE
curl_close($ch);

$resHeaders = substr($response, 0, $headerSize);
$resBody = substr($response, $headerSize);

http_response_code($httpCode);

// Transferir headers de respuesta de Node.js a PHP
foreach (explode("\r\n", $resHeaders) as $headerLine) {
    if (!empty($headerLine) && !preg_match('/^HTTP\//i', $headerLine) && !preg_match('/^Transfer-Encoding:/i', $headerLine)) {
        header($headerLine);
    }
}

echo $resBody;
