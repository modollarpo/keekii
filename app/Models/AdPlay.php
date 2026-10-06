<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per ad impression, written when the ad starts playing.
 *
 * Mirrors App\Models\TrackPlay: append-only, no updated_at, and the same
 * device/location columns so ad reporting can be sliced the same way play
 * reporting already is.
 */
class AdPlay extends Model
{
    use HasFactory;

    const UPDATED_AT = null;

    const OUTCOME_COMPLETED = 'completed';
    const OUTCOME_SKIPPED = 'skipped';

    protected $table = 'ad_plays';

    protected $guarded = [];

    protected $casts = [
        'id' => 'integer',
        'ad_id' => 'integer',
        'user_id' => 'integer',
    ];

    public function ad(): BelongsTo
    {
        return $this->belongsTo(Ad::class);
    }
}
