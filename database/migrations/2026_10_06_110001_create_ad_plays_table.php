<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ad_plays', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('ad_id');
            $table
                ->foreign('ad_id')
                ->references('id')
                ->on('ads')
                ->onDelete('cascade');
            $table->unsignedInteger('user_id')->nullable()->index();
            // null while the ad is on screen; "completed" or "skipped" once it
            // finishes. Rows left null are impressions that never finished.
            $table->string('outcome', 20)->nullable()->index();
            $table->timestamp('created_at')->nullable();

            $table->string('platform', 30)->nullable()->index();
            $table->string('device', 30)->nullable()->index();
            $table->string('browser', 30)->nullable()->index();
            $table->string('location', 5)->nullable()->index();

            $table->index(['ad_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_plays');
    }
};
