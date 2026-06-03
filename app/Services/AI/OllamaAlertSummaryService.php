<?php

namespace App\Services\AI;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class OllamaAlertSummaryService
{
    private const CACHE_PATH = 'smaca-ai-alert-summary.json';

    private const MAX_EVENTS = 20;

    /**
     * @return array{summary: string, generated_at: string|null, source: string, degraded: bool}
     */
    public function getCachedPayload(): array
    {
        try {
            if (! Storage::disk('local')->exists(self::CACHE_PATH)) {
                return $this->emptyPayload();
            }

            $decoded = json_decode((string) Storage::disk('local')->get(self::CACHE_PATH), true);
            if (! is_array($decoded)) {
                return $this->emptyPayload();
            }

            $source = (string) ($decoded['source'] ?? 'none');
            if (! in_array($source, ['ollama', 'fallback'], true)) {
                $source = 'none';
            }

            return [
                'summary' => (string) ($decoded['summary'] ?? ''),
                'generated_at' => isset($decoded['generated_at']) ? (string) $decoded['generated_at'] : null,
                'source' => $source,
                'degraded' => false,
            ];
        } catch (\Throwable $e) {
            $this->logWarning('read_cached_summary_failed', $e);

            return $this->emptyPayload();
        }
    }

    /**
     * @return array{summary: string, generated_at: string, source: string, degraded: bool}
     */
    public function generateAndSave(): array
    {
        $events = $this->fetchRecentEvents();
        $summaryText = null;
        $source = 'fallback';

        if ($this->isOllamaEnabled()) {
            try {
                $ollamaSummary = $this->callOllama($events);
                if ($ollamaSummary !== null && trim($ollamaSummary) !== '') {
                    $summaryText = trim($ollamaSummary);
                    $source = 'ollama';
                }
            } catch (\Throwable $e) {
                $this->logWarning('ollama_generate_failed', $e);
            }
        }

        if ($summaryText === null || $summaryText === '') {
            $summaryText = $this->buildFallbackSummary($events);
            $source = 'fallback';
        }

        $generatedAt = Carbon::now('UTC')->toIso8601String();
        $record = [
            'summary' => $summaryText,
            'generated_at' => $generatedAt,
            'source' => $source,
        ];

        try {
            Storage::disk('local')->put(
                self::CACHE_PATH,
                json_encode($record, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
            );
        } catch (\Throwable $e) {
            $this->logWarning('write_cached_summary_failed', $e);
        }

        return [
            'summary' => $summaryText,
            'generated_at' => $generatedAt,
            'source' => $source,
            'degraded' => $source === 'fallback',
        ];
    }

    /**
     * @return array{summary: string, generated_at: string|null, source: string, degraded: bool}
     */
    private function emptyPayload(): array
    {
        return [
            'summary' => '',
            'generated_at' => null,
            'source' => 'none',
            'degraded' => false,
        ];
    }

    /**
     * @return Collection<int, object>
     */
    private function fetchRecentEvents(): Collection
    {
        try {
            $query = DB::table('alert_events as ae')
                ->join('alerts as a', 'a.id', '=', 'ae.alert_id')
                ->leftJoin('sensors as s', 's.id', '=', 'ae.sensor_id')
                ->select([
                    'ae.id',
                    'ae.status',
                    'ae.value',
                    'ae.triggered_at',
                    'ae.resolved_at',
                    'a.name as alert_name',
                    'a.metric_key',
                    'a.threshold',
                    'a.operator',
                    'ae.sensor_id',
                    's.name as sensor_name',
                    's.external_id as sensor_external_id',
                ])
                ->orderByDesc('ae.triggered_at')
                ->orderByDesc('ae.id')
                ->limit(self::MAX_EVENTS);

            return $query->get();
        } catch (\Throwable $e) {
            $this->logWarning('fetch_alert_events_failed', $e);

            return collect();
        }
    }

    private function isOllamaEnabled(): bool
    {
        if (! (bool) config('ollama.enabled', true)) {
            return false;
        }

        $baseUrl = (string) config('ollama.base_url', '');

        return $baseUrl !== '';
    }

    /**
     * @param  Collection<int, object>  $events
     */
    private function callOllama(Collection $events): ?string
    {
        $baseUrl = rtrim((string) config('ollama.base_url', ''), '/');
        if ($baseUrl === '') {
            return null;
        }

        $timeout = max(1, (int) config('ollama.timeout', 10));
        $model = (string) config('ollama.model', 'llama3.2:1b');
        $prompt = $this->buildPrompt($events);

        $response = Http::timeout($timeout)
            ->acceptJson()
            ->post($baseUrl.'/api/generate', [
                'model' => $model,
                'prompt' => $prompt,
                'stream' => false,
            ]);

        if (! $response->successful()) {
            return null;
        }

        $body = $response->json();
        if (! is_array($body)) {
            return null;
        }

        $text = $body['response'] ?? null;

        return is_string($text) ? $text : null;
    }

    /**
     * @param  Collection<int, object>  $events
     */
    private function buildPrompt(Collection $events): string
    {
        $eventRows = $events->map(static function ($row): array {
            $threshold = $row->threshold ?? null;
            $value = $row->value ?? null;

            return [
                'event_id' => (int) ($row->id ?? 0),
                'status' => (string) ($row->status ?? ''),
                'alert_name' => (string) ($row->alert_name ?? ''),
                'metric_key' => (string) ($row->metric_key ?? ''),
                'operator' => (string) ($row->operator ?? ''),
                'threshold' => $threshold !== null && $threshold !== '' ? (float) $threshold : null,
                'value' => $value !== null && $value !== '' ? (float) $value : null,
                'sensor_id' => isset($row->sensor_id) ? (int) $row->sensor_id : null,
                'sensor_name' => $row->sensor_name !== null ? (string) $row->sensor_name : null,
                'sensor_external_id' => $row->sensor_external_id !== null ? (string) $row->sensor_external_id : null,
                'triggered_at' => $row->triggered_at !== null ? (string) $row->triggered_at : null,
                'resolved_at' => $row->resolved_at !== null ? (string) $row->resolved_at : null,
            ];
        })->values()->all();

        $eventsJson = json_encode($eventRows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($eventsJson === false) {
            $eventsJson = '[]';
        }

        $activeEvents = $events->filter(static fn ($row): bool => (string) ($row->status ?? '') === 'active')->count();
        $totalEvents = $events->count();

        return implode("\n", [
            'You are a facilities monitoring assistant for the SMACA IoT dashboard.',
            'Summarize the supplied alert_events for an admin operator.',
            '',
            'Counts: total_events='.$totalEvents.', active_events='.$activeEvents,
            '',
            'Strict rules:',
            '- Use only the supplied alert_events data.',
            '- Do not invent alerts, sensors, times, causes, or extra events.',
            '- Count each alert_event row exactly once.',
            '- If there is 1 alert_event row, say "1 event".',
            '- If active_events is 0, clearly state that there are no active alerts now.',
            '- Do not count triggered_at and resolved_at as two events.',
            '- Maximum 120 words.',
            '',
            'Return exactly 3 bullets:',
            '- Current status',
            '- Main metric / sensor involved',
            '- Recommended operational action',
            '',
            'Alert data:',
            $eventsJson,
        ]);
    }

    /**
     * @param  Collection<int, object>  $events
     */
    private function buildFallbackSummary(Collection $events): string
    {
        if ($events->isEmpty()) {
            return 'No alert events are recorded. Alert rules are idle; no operator action is required.';
        }

        $active = $events->filter(static fn ($row) => (string) $row->status === 'active')->count();
        $resolved = $events->filter(static fn ($row) => (string) $row->status === 'resolved')->count();
        $total = $events->count();

        $metricCounts = [];
        $alertCounts = [];
        foreach ($events as $row) {
            $metric = (string) ($row->metric_key ?? 'unknown');
            $metricCounts[$metric] = ($metricCounts[$metric] ?? 0) + 1;
            $alertName = (string) ($row->alert_name ?? 'Alert');
            $alertCounts[$alertName] = ($alertCounts[$alertName] ?? 0) + 1;
        }

        arsort($metricCounts);
        arsort($alertCounts);

        $topMetric = array_key_first($metricCounts);
        $topAlert = array_key_first($alertCounts);

        $parts = [
            sprintf(
                'Cached summary (fallback): %d recent event(s) reviewed (%d active, %d resolved).',
                $total,
                $active,
                $resolved
            ),
        ];

        if ($topMetric) {
            $parts[] = sprintf(
                'Most frequent metric: %s (%d occurrence(s)).',
                $topMetric,
                (int) $metricCounts[$topMetric]
            );
        }

        if ($topAlert) {
            $parts[] = sprintf(
                'Most frequent rule: %s (%d occurrence(s)).',
                $topAlert,
                (int) $alertCounts[$topAlert]
            );
        }

        if ($active > 0) {
            $parts[] = 'Review active events in the table below and confirm sensor readings before changing thresholds.';
        } else {
            $parts[] = 'No active events in the latest window; continue routine monitoring.';
        }

        return implode(' ', $parts);
    }

    private function logWarning(string $context, \Throwable $e): void
    {
        try {
            Log::warning('OllamaAlertSummaryService: '.$context, [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $ignored) {
        }
    }
}
