<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tracks', function (Blueprint $table) {
            // guarded: this file was renamed after being authored, so an
            // earlier run under the old name may already have applied it
            if (!Schema::hasColumn('tracks', 'bpm')) {
                $table->decimal('bpm', 5, 2)->unsigned()->nullable();
            }
            if (!Schema::hasColumn('tracks', 'musical_key')) {
                $table->string('musical_key', 10)->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tracks', function (Blueprint $table) {
            $columns = array_filter(
                ['bpm', 'musical_key'],
                fn ($column) => Schema::hasColumn('tracks', $column),
            );
            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
