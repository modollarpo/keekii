<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // An earlier attempt at this migration created the table and then
        // failed on the foreign key (ad_id was an int while ads.id is a
        // bigint), so MySQL left the table behind without the constraint and
        // Laravel never recorded the migration. It is empty - nothing could
        // be written to it - so drop the partial table and start clean.
        Schema::dropIfExists('ad_plays');

        Schema::create('ad_plays', function (Blueprint $table) {
            $table->id();
            // bigint unsigned to match ads.id, which is $table->id(). The
            // int type this started with is what MySQL rejected with errno 150.
            $table->unsignedBigInteger('ad_id');
            $table
                ->foreign('ad_id')
                ->references('id')
                ->on('ads')
                ->onDelete('cascade');
            // int unsigned to match users.id, which is $table->increments('id').
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
