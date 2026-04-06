<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('site_id');
            $table->string('name');
            $table->string('metric_key');
            $table->string('operator');
            $table->decimal('threshold', total: 18, places: 4);
            $table->unsignedBigInteger('sensor_id');
            $table->string('device_type');
            $table->boolean('is_enabled')->default(true);
            $table->unsignedBigInteger('created_by');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};