<?php

namespace App\Services\KPI;

/**
 * Read-only accessor for config/smaca_sensor_semantics.php.
 */
class SensorSemanticRegistry
{
    /** @var array<string, mixed> */
    private array $config;

    public function __construct(?array $config = null)
    {
        $this->config = is_array($config) ? $config : (array) config('smaca_sensor_semantics', []);
    }

    public function all(): array
    {
        return $this->config;
    }

    public function defaults(): array
    {
        $d = $this->config['defaults'] ?? [];

        return [
            'tvoc_semantic_mode' => $this->normalizeTvocMode($d['tvoc_semantic_mode'] ?? 'iaq_rating_level'),
            'light_semantic_mode' => $this->normalizeLightMode($d['light_semantic_mode'] ?? 'normalized_level_0_5'),
        ];
    }

    public function tvocMode(): string
    {
        return $this->defaults()['tvoc_semantic_mode'];
    }

    public function lightMode(): string
    {
        return $this->defaults()['light_semantic_mode'];
    }

    public function tvocModeConfig(string $mode): array
    {
        $modes = (array) ($this->config['tvoc_modes'] ?? []);

        return (array) ($modes[$mode] ?? []);
    }

    public function lightModeConfig(string $mode): array
    {
        $modes = (array) ($this->config['light_modes'] ?? []);

        return (array) ($modes[$mode] ?? []);
    }

    public function environmentalSafetyDefaults(): array
    {
        return (array) ($this->config['environmental_safety'] ?? []);
    }

    public function thermalComfortBands(): array
    {
        return (array) ($this->config['thermal_comfort'] ?? []);
    }

    public function co2VentilationBands(): array
    {
        return (array) ($this->config['co2_ventilation_bands'] ?? []);
    }

    private function normalizeTvocMode(string $mode): string
    {
        $m = strtolower(trim($mode));

        return in_array($m, ['raw_tvoc_ugm3', 'iaq_rating_level'], true) ? $m : 'iaq_rating_level';
    }

    private function normalizeLightMode(string $mode): string
    {
        $m = strtolower(trim($mode));

        return in_array($m, ['normalized_level_0_5', 'raw_lux'], true) ? $m : 'normalized_level_0_5';
    }
}
