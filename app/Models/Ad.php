<?php

namespace App\Models;

use Common\Core\BaseModel;
use Illuminate\Database\Eloquent\Builder;

class Ad extends BaseModel
{
    const MODEL_TYPE = 'ad';

    const TYPE_VIDEO = 'video';
    const TYPE_IMAGE_WITH_VOICE = 'imageWithVoice';

    protected $table = 'ads';

    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'weight' => 'integer',
        'skip_after_seconds' => 'integer',
        'is_active' => 'boolean',
        'impressions' => 'integer',
        'completions' => 'integer',
        'skips' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    /**
     * Ads that could legally be served right now: switched on, inside their
     * date window, and holding every creative the declared type needs. A
     * missing bound is treated as open ended.
     */
    public function scopeEligible(Builder $query): Builder
    {
        return $query
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->where(function (Builder $q) {
                $q->where(function (Builder $qq) {
                    $qq->where('type', self::TYPE_VIDEO)
                        ->whereNotNull('video_path');
                })->orWhere(function (Builder $qq) {
                    $qq->where('type', self::TYPE_IMAGE_WITH_VOICE)
                        ->whereNotNull('image_path')
                        ->whereNotNull('voiceover_path');
                });
            });
    }

    /**
     * Weighted pick for the player's pre-roll slot. Returns null when nothing
     * can be served, which callers treat as "no ad this session".
     */
    public static function pickEligible(): ?self
    {
        $ads = static::eligible()->get();
        if ($ads->isEmpty()) {
            return null;
        }

        $total = (int) $ads->sum(fn (self $ad) => max(1, (int) $ad->weight));
        $roll = random_int(1, $total);

        foreach ($ads as $ad) {
            $roll -= max(1, (int) $ad->weight);
            if ($roll <= 0) {
                return $ad;
            }
        }

        return $ads->last();
    }

    public function plays()
    {
        return $this->hasMany(AdPlay::class);
    }

    public static function filterableFields(): array
    {
        return ['id', 'is_active', 'type', 'created_at', 'updated_at'];
    }

    public static function sortableFields(): array
    {
        return [
            'id',
            'name',
            'type',
            'weight',
            'impressions',
            'completions',
            'skips',
            'created_at',
            'updated_at',
        ];
    }
}
