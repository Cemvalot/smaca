<?php

namespace App\Console\Commands;

use App\Services\AI\OllamaAlertSummaryService;
use Illuminate\Console\Command;

class AiAlertSummaryCommand extends Command
{
    protected $signature = 'smaca:ai-alert-summary';

    protected $description = 'Generate and cache an AI summary of recent SMACA alert events via Ollama (with deterministic fallback)';

    public function handle(OllamaAlertSummaryService $service): int
    {
        $result = $service->generateAndSave();

        $this->info('source='.$result['source']);
        $this->info('generated_at='.$result['generated_at']);

        return self::SUCCESS;
    }
}
