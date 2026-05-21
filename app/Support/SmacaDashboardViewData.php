<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class SmacaDashboardViewData
{
    /**
     * @return array<string, mixed>
     */
    public static function build(string $smacaPage): array
    {
        $needsManagementData = $smacaPage === 'management';

        $sites = collect();
        $sensors = collect();
        $sensor_latest = collect();
        $currentUser = DB::table('users')
            ->select(['id', 'name', 'email', 'role'])
            ->where('id', session('user_id'))
            ->first();

        if ($needsManagementData) {
            $sites = DB::table('sites')
                ->select(['id', 'name'])
                ->get();

            $sensors = DB::table('sensors')
                ->select(['id', 'site_id', 'name', 'external_id', 'device_type', 'is_active'])
                ->orderBy('id')
                ->get();

            $sensor_latest = DB::table('sensor_latest')
                ->select(['sensor_id', 'measured_at', 'battery_pct'])
                ->get();
        }

        $iaqSemDefaults = config('smaca_sensor_semantics.defaults', []);
        $smacaIaqTvocMode = $iaqSemDefaults['tvoc_semantic_mode'] ?? 'iaq_rating_level';
        $smacaIaqLightMode = $iaqSemDefaults['light_semantic_mode'] ?? 'normalized_level_0_5';
        $smacaIaqTvocModeLabel = $smacaIaqTvocMode === 'raw_tvoc_ugm3'
            ? __('messages.iaq_semantic_mode.tvoc_raw_tvoc_ugm3')
            : __('messages.iaq_semantic_mode.tvoc_iaq_rating_level');
        $smacaIaqLightModeLabel = $smacaIaqLightMode === 'raw_lux'
            ? __('messages.iaq_semantic_mode.light_raw_lux')
            : __('messages.iaq_semantic_mode.light_normalized_level_0_5');

        return [
            'smacaPage' => $smacaPage,
            'sites' => $sites,
            'sensors' => $sensors,
            'sensor_latest' => $sensor_latest,
            'currentUser' => $currentUser,
            'smacaIaqTvocMode' => $smacaIaqTvocMode,
            'smacaIaqLightMode' => $smacaIaqLightMode,
            'smacaIaqTvocModeLabel' => $smacaIaqTvocModeLabel,
            'smacaIaqLightModeLabel' => $smacaIaqLightModeLabel,
        ];
    }
}
