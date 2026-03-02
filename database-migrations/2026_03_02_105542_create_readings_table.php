<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('readings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sensor_id');
            $table->timestamp('measured_at');
            $table->string('message_uid', 100)->nullable();
            $table->json('payload')->nullable();
            $table->json('metrics')->nullable();

            $table->decimal('battery_pct', 5, 2)->nullable();
            $table->decimal('co2_ppm', 10, 2)->nullable();
            $table->decimal('temperature_c', 6, 2)->nullable();
            $table->decimal('humidity_rh', 6, 2)->nullable();
            $table->decimal('pressure_hpa', 8, 2)->nullable();
            $table->decimal('tvoc_index', 10, 2)->nullable();
            $table->decimal('pm2_5_ugm3', 10, 2)->nullable();
            $table->decimal('pm10_ugm3', 10, 2)->nullable();
            $table->decimal('light_level', 12, 2)->nullable();

            $table->smallInteger('pir')->nullable();
            $table->integer('people_in')->nullable();
            $table->integer('people_out')->nullable();
            $table->integer('people_total_in')->nullable();
            $table->integer('people_total_out')->nullable();

            $table->decimal('uv_index', 10, 2)->nullable();
            $table->smallInteger('gpio_in1')->nullable();
            $table->smallInteger('gpio_in2')->nullable();

            $table->decimal('energy_kwh', 14, 4)->nullable();
            $table->decimal('current_a', 12, 4)->nullable();
            $table->decimal('power_factor', 8, 4)->nullable();
            $table->decimal('frequency_hz', 8, 2)->nullable();
            $table->decimal('max_demand_kw', 12, 4)->nullable();

            $table->bigInteger('meter_serial')->nullable();

            $table->timestamps();

            $table->index(['sensor_id', 'measured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('readings');
    }
};