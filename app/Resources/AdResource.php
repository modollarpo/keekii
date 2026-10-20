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
            // Remote (KIKI network) fill. `remote` tells the client this ad
            // was decided by the network, so it opens the impression against
            // the network rather than the local ads table. `tracking` carries
            // the signed beacon URLs; null for locally managed ads.
            'remote' => (bool) $this->remote,
            'remote_impression_id' => $this->remote_impression_id,
            'tracking' => $this->remote ? $this->remote_tracking : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'model_type' => Ad::MODEL_TYPE,
        ];
    }
}
