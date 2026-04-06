<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('readings', function (Blueprint $table) {
            $table->dateTime('measured_at')->change();
        });
    }

    public function down(): void
    {
        Schema::table('readings', function (Blueprint $table) {
            $table->timestamp('measured_at')->change();
        });
    }
};