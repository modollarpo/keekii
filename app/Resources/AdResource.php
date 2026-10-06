<?php

namespace App\Resources;

use App\Models\Ad;
use Dedoc\Scramble\Attributes\SchemaName;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Ad
 */
#[SchemaName('Ad')]
class AdResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'name' => $this->name,
            'advertiser_name' => $this->advertiser_name,
            'video_path' => $this->video_path,
            'image_path' => $this->image_path,
            'voiceover_path' => $this->voiceover_path,
            'click_through_url' => $this->click_through_url,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'weight' => $this->weight,
            'skip_after_seconds' => $this->skip_after_seconds,
            'is_active' => $this->is_active,
            'impressions' => $this->impressions,
            'completions' => $this->completions,
            'skips' => $this->skips,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'model_type' => Ad::MODEL_TYPE,
        ];
    }
}
