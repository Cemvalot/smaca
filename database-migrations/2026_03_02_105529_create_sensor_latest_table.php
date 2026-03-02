<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sensor_latest', function (Blueprint $table) {
            $table->unsignedBigInteger('sensor_id')->primary();
            $table->unsignedBigInteger('reading_id')->nullable();
            $table->timestamp('measured_at', precision: 0)->nullable();

            $table->decimal('battery_pct', total: 7, places: 2)->nullable();
            $table->decimal('co2_ppm', total: 12, places: 2)->nullable();
            $table->decimal('temperature_c', total: 8, places: 2)->nullable();
            $table->decimal('humidity_rh', total: 12, places: 2)->nullable();
            $table->decimal('pm2_5_ugm3', total: 12, places: 2)->nullable();
            $table->decimal('pm10_ugm3', total: 12, places: 2)->nullable();
            $table->decimal('energy_kwh', total: 14, places: 4)->nullable();
            $table->decimal('uv_index', total: 12, places: 2)->nullable();
            $table->integer('people_in')->nullable();
            $table->integer('people_out')->nullable();
            $table->integer('people_total_in')->nullable();
            $table->integer('people_total_out')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sensor_latest');
    }
};