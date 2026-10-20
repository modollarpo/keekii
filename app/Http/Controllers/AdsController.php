<?php

namespace App\Http\Controllers;

use App\Models\Ad;
use App\Models\AdPlay;
use App\QueryBuilders\AdsQueryBuilder;
use App\Resources\AdResource;
use App\Services\Ads\AdNetworkClient;
use App\Services\Ads\LogAdPlay;
use Common\Core\Demo\BlockedOnDemoSite;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * @tags Ads
 */
class AdsController extends Controller
{
    /**
     * List all player ads.
     *
     * @operationId listAds
     */
    public function index(Request $request)
    {
        Gate::authorize('index', Ad::class);

        $data = $request->validate([
            'query' => 'nullable|string',
            'per_page' => 'integer|min:1|max:100',
            'page' => 'integer|min:1',
            'sort' => 'string',
            'id' => 'nullable',
            'type' => 'nullable|string',
            'is_active' => 'nullable|string',
            'created_at' => 'nullable',
            'created_at.*' => 'string',
            'updated_at' => 'nullable',
            'updated_at.*' => 'string',
        ]);

        $pagination = (new AdsQueryBuilder($data))->paginate();

        return AdResource::collection($pagination);
    }

    /**
     * Pick the next ad to pre-roll ahead of a track.
     *
     * The KIKI ad network is the primary source: when it is configured and
     * returns a fill, that creative is served and the network owns the
     * impression. Otherwise the locally managed `ads` table is consulted, so
     * an install without the network (or one whose call fails) behaves exactly
     * as before. Returning null is a normal outcome and simply means "no ad",
     * which the client treats as a green light to play music.
     *
     * @operationId nextPlayerAd
     */
    public function next(Request $request)
    {
        $remote = app(AdNetworkClient::class)->request(
            contentId: $request->input('content_id'),
        );

        if ($remote) {
            return response()->json([
                'data' => (new AdResource($remote))->toArray($request),
            ]);
        }

        $ad = Ad::pickEligible();

        return response()->json([
            'data' => $ad ? (new AdResource($ad))->toArray($request) : null,
        ]);
    }

    /**
     * Open an impression for a served ad.
     *
     * For a network ad the impression was already opened server-side when the
     * decision was made, so this fires the first tracking beacon and echoes
     * the network impression id so the client can close it later. For a local
     * ad it records a row in ad_plays as before.
     *
     * @operationId logAdPlay
     */
    public function logPlay(int $id, Request $request)
    {
        if ($request->boolean('remote')) {
            $impressionId = (string) $request->input('impression_id');

            if ($impressionId !== '') {
                app(AdNetworkClient::class)->beacon(
                    $request->input('tracking.impression') ?: null,
                );
            }

            return response()->json([
                'data' => [
                    'id' => $impressionId,
                    'impression_id' => $impressionId,
                    'remote' => true,
                ],
            ]);
        }

        $ad = Ad::findOrFail($id);
        $play = (new LogAdPlay())->start($ad);

        return response()->json(['data' => ['id' => $play->id]]);
    }

    /**
     * Close an ad impression with completed or skipped.
     *
     * A remote impression id (a uuid, not an ad_plays row) fires the matching
     * completion/skip beacon. A local impression id closes its ad_plays row.
     *
     * @operationId finishAdPlay
     */
    public function finishPlay(string $playId, Request $request)
    {
        $data = $request->validate([
            'outcome' => [
                'required',
                Rule::in([AdPlay::OUTCOME_COMPLETED, AdPlay::OUTCOME_SKIPPED]),
            ],
            'remote' => ['nullable', 'boolean'],
            'tracking' => ['nullable', 'array'],
        ]);

        if ($request->boolean('remote')) {
            $event = $data['outcome'] === AdPlay::OUTCOME_COMPLETED
                ? 'complete'
                : 'skip';
            app(AdNetworkClient::class)->beacon(
                $request->input("tracking.$event") ?: null,
            );

            return response()->noContent();
        }

        $play = AdPlay::findOrFail($playId);
        (new LogAdPlay())->finish($play, $data['outcome']);

        return response()->noContent();
    }

    /**
     * Create a player ad.
     *
     * @operationId createAd
     */
    #[BlockedOnDemoSite]
    public function store(Request $request)
    {
        Gate::authorize('store', Ad::class);

        $ad = Ad::create($this->validateAd($request));

        return new AdResource($ad);
    }

    /**
     * Update a player ad.
     *
     * @operationId updateAd
     */
    #[BlockedOnDemoSite]
    public function update(int $id, Request $request)
    {
        Gate::authorize('update', Ad::class);

        $ad = Ad::findOrFail($id);
        $ad->update($this->validateAd($request, $id));

        return new AdResource($ad);
    }

    /**
     * Delete player ads.
     *
     * @operationId deleteAds
     */
    #[BlockedOnDemoSite]
    public function destroy(string $ids)
    {
        $adIds = explode(',', $ids);
        Gate::authorize('destroy', [Ad::class, $adIds]);

        Ad::destroy($adIds);

        return response()->noContent();
    }

    private function validateAd(Request $request, int|null $ignoreId = null): array
    {
        $data = $request->validate([
            'type' => [
                'required',
                Rule::in([Ad::TYPE_VIDEO, Ad::TYPE_IMAGE_WITH_VOICE]),
            ],
            'name' => ['required', 'string', 'max:150'],
            'advertiser_name' => ['required', 'string', 'max:150'],
            'video_path' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf($request->input('type') === Ad::TYPE_VIDEO),
            ],
            'image_path' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf(
                    $request->input('type') === Ad::TYPE_IMAGE_WITH_VOICE,
                ),
            ],
            'voiceover_path' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf(
                    $request->input('type') === Ad::TYPE_IMAGE_WITH_VOICE,
                ),
            ],
            'click_through_url' => ['nullable', 'string', 'url', 'max:2000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'weight' => ['required', 'integer', 'min:1', 'max:100000'],
            'skip_after_seconds' => ['nullable', 'integer', 'min:0', 'max:600'],
            'is_active' => ['boolean'],
        ]);

        if (
            !empty($data['starts_at']) &&
            !empty($data['ends_at']) &&
            strtotime($data['ends_at']) < strtotime($data['starts_at'])
        ) {
            throw ValidationException::withMessages([
                'ends_at' => __('The end date must be on or after the start date.'),
            ]);
        }

        // Product rule: image-with-voice ads are never skippable, so any
        // submitted skip delay is discarded rather than trusted.
        if ($data['type'] !== Ad::TYPE_VIDEO) {
            $data['skip_after_seconds'] = null;
        }

        if ($ignoreId && !isset($data['is_active'])) {
            unset($data['is_active']);
        }

        return $data;
    }
}
