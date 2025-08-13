<?php
/**
 * OpenAI Session Key Generator
 * 
 * Generates ephemeral session tokens for OpenAI Realtime API
 * Called by LanguageTutor class for authentication
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use GET.']);
    exit;
}

try {
    // Load API key from config file
    require_once '../config/config.php';
    
    if (!defined('OPENAI_API_KEY') || empty(OPENAI_API_KEY)) {
        throw new Exception('OPENAI_API_KEY not defined in config.php');
    }
    
    // Generate session token for Realtime API
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.openai.com/v1/realtime/sessions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . OPENAI_API_KEY,
        'Content-Type: application/json',
        'OpenAI-Beta: realtime=v1'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'model' => 'gpt-4o-realtime-preview-2024-10-01',
        'voice' => 'alloy'
    ]));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        throw new Exception('cURL error: ' . $error);
    }
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response from OpenAI API');
        }
        
        // Check if we got a client_secret or if we should use the API key directly
        if (isset($data['client_secret']['value'])) {
            echo json_encode([
                'session_token' => $data['client_secret']['value'],
                'expires_in' => 60, // Session tokens expire in 60 seconds
                'generated_at' => time()
            ]);
            exit;
        }
    }
    // Try to parse error response
    $errorData = json_decode($response, true);
    $errorMessage = 'Unknown API error';
    
    if ($errorData && isset($errorData['error']['message'])) {
        $errorMessage = $errorData['error']['message'];
    } elseif ($response) {
        $errorMessage = $response;
    }
    
    throw new Exception('OpenAI API error (HTTP ' . $httpCode . '): ' . $errorMessage);
    
} catch (Exception $e) {
    error_log('OpenAI Key Generator Error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'timestamp' => time()
    ]);
}
