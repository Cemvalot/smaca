<?php

return [
    'base_url' => rtrim((string) env('OLLAMA_BASE_URL', 'http://192.168.158.8:11434'), '/'),
    'model' => (string) env('OLLAMA_MODEL', 'llama3.2:1b'),
    'timeout' => (int) env('OLLAMA_TIMEOUT', 10),
    'enabled' => filter_var(env('OLLAMA_ENABLED', true), FILTER_VALIDATE_BOOL),
];
