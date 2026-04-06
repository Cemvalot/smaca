<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('alert_id');
            $table->unsignedBigInteger('sensor_id');
            $table->unsignedBigInteger('reading_id')->nullable();
            $table->timestamp('triggered_at', precision: 0)->nullable();
            $table->decimal('value', total: 18, places: 4);
            $table->string('status');
            $table->unsignedBigInteger('ack_by')->nullable();
            $table->timestamp('ack_at', precision: 0)->nullable();
            $table->timestamp('resolved_at', precision: 0)->nullable();
            $table->json('details')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_events');
    }
};