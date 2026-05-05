<?php

namespace App\Services\KPI;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class KPIInputAssembler
{
    public function assembleSummaryInputs(): array
    {
        $schema = DB::getSchemaBuilder();
        $latest = null;
        if ($schema->hasTable('sensor_latest')) {
            $latestSelects = [];
            if ($schema->hasColumn('sensor_latest', 'co2_ppm')) {
                $latestSelects[] = 'AVG(co2_ppm) as avg_co2_ppm';
            }
            if ($schema->hasColumn('sensor_latest', 'tvoc_index')) {
                $latestSelects[] = 'AVG(tvoc_index) as avg_tvoc_index';
            }
            if ($schema->hasColumn('sensor_latest', 'pm2_5_ugm3')) {
                $latestSelects[] = 'AVG(pm2_5_ugm3) as avg_pm25_ugm3';
            }
            if ($schema->hasColumn('sensor_latest', 'pm10_ugm3')) {
                $latestSelects[] = 'AVG(pm10_ugm3) as avg_pm10_ugm3';
            }
            if ($schema->hasColumn('sensor_latest', 'temperature_c')) {
                $latestSelects[] = 'AVG(temperature_c) as avg_temperature_c';
            }
            if ($schema->hasColumn('sensor_latest', 'humidity_rh')) {
                $latestSelects[] = 'AVG(humidity_rh) as avg_humidity_rh';
            }
            if ($schema->hasColumn('sensor_latest', 'energy_kwh')) {
                $latestSelects[] = 'AVG(energy_kwh) as avg_energy_kwh';
            }
            if ($schema->hasColumn('sensor_latest', 'people_total_in') && $schema->hasColumn('sensor_latest', 'people_total_out')) {
                $latestSelects[] = 'AVG(COALESCE(people_total_in, 0) - COALESCE(people_total_out, 0)) as avg_people_present';
            }

            if (!empty($latestSelects)) {
                $latest = DB::table('sensor_latest')
                    ->selectRaw(implode(', ', $latestSelects))
                    ->first();
            }
        }

        $currentWindowStart = Carbon::now()->subHours(24);
        $offHoursStart = Carbon::now()->subDays(7);

        $readingsSelects = [];
        if ($schema->hasColumn('readings', 'current_a')) {
            $readingsSelects[] = 'AVG(current_a) as avg_current_a';
        }
        if ($schema->hasColumn('readings', 'power_factor')) {
            $readingsSelects[] = 'AVG(power_factor) as avg_power_factor';
        }
        if ($schema->hasColumn('readings', 'max_demand_kw')) {
            $readingsSelects[] = 'AVG(max_demand_kw) as avg_max_demand_kw';
        }
        if ($schema->hasColumn('readings', 'light_level')) {
            $readingsSelects[] = 'AVG(light_level) as avg_light_level';
        }
        if ($schema->hasColumn('readings', 'lux')) {
            $readingsSelects[] = 'AVG(lux) as avg_lux';
        }
        if ($schema->hasColumn('readings', 'solar_radiation')) {
            $readingsSelects[] = 'AVG(solar_radiation) as avg_solar_radiation';
        }
        if ($schema->hasColumn('readings', 'energy_kwh')) {
            $readingsSelects[] = 'AVG(energy_kwh) as avg_energy_kwh_recent';
        }
        if ($schema->hasColumn('readings', 'people_total_in') && $schema->hasColumn('readings', 'people_total_out')) {
            $readingsSelects[] = 'AVG(COALESCE(people_total_in, 0) - COALESCE(people_total_out, 0)) as avg_people_present_recent';
        }

        $currentReadings = null;
        if (!empty($readingsSelects)) {
            $currentReadings = DB::table('readings')
                ->selectRaw(implode(', ', $readingsSelects))
                ->where('measured_at', '>=', $currentWindowStart)
                ->first();
        }

        $baseLoadData = null;
        if ($schema->hasColumn('readings', 'energy_kwh')) {
            $offHourCondition = "(
                HOUR(measured_at) BETWEEN 0 AND 6
                OR DAYOFWEEK(measured_at) IN (1, 7)
            )";
            $occupancyNearZero = '';
            if ($schema->hasColumn('readings', 'people_total_in') && $schema->hasColumn('readings', 'people_total_out')) {
                $occupancyNearZero = " AND ABS(COALESCE(people_total_in, 0) - COALESCE(people_total_out, 0)) <= 1";
            }

            $baseLoadData = DB::table('readings')
                ->selectRaw('AVG(energy_kwh) as avg_base_load_energy')
                ->selectRaw('AVG(CASE WHEN '.$offHourCondition.$occupancyNearZero.' THEN energy_kwh END) as avg_off_hours_energy')
                ->where('measured_at', '>=', $offHoursStart)
                ->first();
        }

        $roomCapacity = null;
        if ($schema->hasTable('rooms') && $schema->hasColumn('rooms', 'capacity') && $schema->hasColumn('sensors', 'room_id')) {
            $roomCapacity = DB::table('sensors')
                ->leftJoin('rooms', 'rooms.id', '=', 'sensors.room_id')
                ->where('sensors.is_active', true)
                ->avg('rooms.capacity');
        }

        $activeSensors = (int) DB::table('sensors')
            ->where('is_active', true)
            ->count();
        $fallbackCapacity = max(50, $activeSensors * 20);

        $avgEnergy = $this->toFloat($latest->avg_energy_kwh ?? null)
            ?? $this->toFloat($currentReadings->avg_energy_kwh_recent ?? null);
        $avgPeople = $this->toFloat($latest->avg_people_present ?? null)
            ?? $this->toFloat($currentReadings->avg_people_present_recent ?? null);

        return [
            'avg_co2_ppm' => $this->toFloat($latest->avg_co2_ppm ?? null),
            'avg_tvoc_index' => $this->toFloat($latest->avg_tvoc_index ?? null),
            'avg_pm25_ugm3' => $this->toFloat($latest->avg_pm25_ugm3 ?? null),
            'avg_pm10_ugm3' => $this->toFloat($latest->avg_pm10_ugm3 ?? null),
            'avg_temperature_c' => $this->toFloat($latest->avg_temperature_c ?? null),
            'avg_humidity_rh' => $this->toFloat($latest->avg_humidity_rh ?? null),
            'avg_energy_kwh' => $avgEnergy,
            'avg_current_a' => $this->toFloat($currentReadings->avg_current_a ?? null),
            'avg_power_factor' => $this->toFloat($currentReadings->avg_power_factor ?? null),
            'avg_max_demand_kw' => $this->toFloat($currentReadings->avg_max_demand_kw ?? null),
            'avg_light_level' => $this->toFloat($currentReadings->avg_light_level ?? null),
            'avg_lux' => $this->toFloat($currentReadings->avg_lux ?? null),
            'avg_solar_radiation' => $this->toFloat($currentReadings->avg_solar_radiation ?? null),
            'avg_people_present' => max(0.0, $avgPeople ?? 0.0),
            'max_capacity' => $this->toFloat($roomCapacity) ?? (float) $fallbackCapacity,
            'capacity_confidence' => $roomCapacity !== null ? 'measured' : 'estimated',
            'avg_base_load_energy' => $this->toFloat($baseLoadData->avg_base_load_energy ?? null),
            'avg_off_hours_energy' => $this->toFloat($baseLoadData->avg_off_hours_energy ?? null),
        ];
    }

    private function toFloat($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $numeric = (float) $value;
        return is_finite($numeric) ? $numeric : null;
    }
}
