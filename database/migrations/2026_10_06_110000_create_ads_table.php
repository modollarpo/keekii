<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ads', function (Blueprint $table) {
            $table->id();
            // "video" plays a video creative; "imageWithVoice" shows a still
            // image plus a voiceover audio track.
            $table->string('type', 30);
            // admin facing label, never shown to a listener.
            $table->string('name');
            // shown to the listener while the ad is on screen.
            $table->string('advertiser_name');
            $table->string('video_path')->nullable();
            $table->string('image_path')->nullable();
            $table->string('voiceover_path')->nullable();
            $table->string('click_through_url')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            // relative rotation weight between ads that are eligible right now.
            $table->unsignedInteger('weight')->default(1);
            // null means the ad plays through with no skip offer.
            $table->unsignedSmallInteger('skip_after_seconds')->nullable();
            $table->boolean('is_active')->default(true);
            // denormalised counters so the datatable can show totals without
            // aggregating ad_plays on every render.
            $table->unsignedInteger('impressions')->default(0);
            $table->unsignedInteger('completions')->default(0);
            $table->unsignedInteger('skips')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ads');
    }
};
