<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Index track_plays for the per-artist analytics query path.
 *
 * The existing index from 2026_01_22_114904 is (user_id, track_id, created_at).
 * A composite index is only usable from its leftmost column, so a predicate of
 * `WHERE track_id IN (...) AND created_at BETWEEN ...` cannot use it: MySQL has
 * no value for user_id to anchor on and falls back to a scan.
 *
 * That is exactly the shape backstage insights issues, via
 * BuildInsightsReport::artistPlaysQuery(), so artist and album play charts
 * were scanning the whole table as plays accumulated.
 *
 * Both indexes are kept. This one serves track/date aggregation; the original
 * still serves per-user play history, which leads on user_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('track_plays', function (Blueprint $table) {
            $table->index(['track_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('track_plays', function (Blueprint $table) {
            $table->dropIndex(['track_id', 'created_at']);
        });
    }
};