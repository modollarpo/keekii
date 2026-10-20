<?php

namespace App\Services\Ads;

use App\Models\Ad;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Client for the KIKI ad network (remote fill for the pre-roll slot).
 *
 * The network decides which creative to serve and owns click/impression
 * accounting; this class only talks to it and maps the response onto the
 * shape the rest of the app already understands (App\Models\Ad). Every method
 * is fail-open: an unreachable or misconfigured network returns null / no-ops
 * so the listener always falls through to the real track.
 *
 * Deliberately separate from App\Models\Ad: the local model and the remote
 * decision are two different sources of truth, and keeping them apart means a
 * network outage can never look like "no ads configured".
 */
class AdNetworkClient
{
    /**
     * Ask the network for a pre-roll creative.
     *
     * Returns a transient, unsaved Ad carrying the remote ids in the
     * `remote_*` attributes, or null for no fill / any failure.
     */
    public function request(
        string|null $contentId = null,
        array $user = [],
        array $cap = [],
    ): ?Ad {
        if (!$this->isConfigured()) {
            return null;
        }

        try {
            $response = $this->requestWithAuth()
                ->post('/api/ads/request', array_filter([
                    'property' => config('keekii-ads.property'),
                    'slot' => 'preroll',
                    'format' => 'audio',
                    'contentId' => $contentId,
                    'user' => $user ?: null,
                    'cap' => $cap ?: null,
                ]));

            if (!$response->successful()) {
                return null;
            }

            $body = $response->json();
        } catch (\Throwable) {
            // Unreachable network, DNS failure, timeout: no ad this session.
            return null;
        }

        if (!is_array($body) || ($body['ok'] ?? false) !== true) {
            return null;
        }

        $creative = $body['creative'] ?? null;
        if (!is_array($creative) || empty($creative['mediaUrl'])) {
            return null;
        }

        return $this->toAd($body, $creative);
    }

    /**
     * Fire a tracking beacon (impression, firstQuartile, complete, skip...).
     * Best effort: the URL already carries its own HMAC, so nothing here needs
     * to be awaited or checked.
     */
    public function beacon(string|null $url): void
    {
        if (!$url) {
            return;
        }

        try {
            Http::timeout((int) config('keekii-ads.timeout', 2))
                ->withHeaders(['User-Agent' => 'Keekii/1.0 (+ads)'])
                ->get($url);
        } catch (\Throwable) {
            // Tracking must never surface to the player.
        }
    }

    public function isConfigured(): bool
    {
        return (bool) config('keekii-ads.base_url')
            && (bool) config('keekii-ads.secret');
    }

    /**
     * Map the network response onto a transient Ad. `id` is negative and
     * derived from the impression id so the frontend's ad-media prefix can
     * never collide with a real, persisted ad id.
     */
    private function toAd(array $body, array $creative): Ad
    {
        $impressionId = (string) ($body['impressionId'] ?? '');
        $tracking = $body['tracking'] ?? [];

        $ad = new Ad([
            'type' => Ad::TYPE_IMAGE_WITH_VOICE,
            'name' => $creative['name'] ?? 'Sponsored',
            'advertiser_name' => $creative['advertiser'] ?? 'KIKI Network',
            // Audio creatives carry no still image; the player shows its own
            // placeholder when image_path is null.
            'image_path' => null,
            'voiceover_path' => $creative['mediaUrl'] ?? null,
            'click_through_url' => $creative['clickThroughUrl'] ?? null,
            'weight' => 1,
            'skip_after_seconds' => $creative['skipAfterSeconds'] ?? null,
            'is_active' => true,
            'impressions' => 0,
            'completions' => 0,
            'skips' => 0,
        ]);

        $ad->remote = true;
        $ad->remote_impression_id = $impressionId ?: null;
        $ad->remote_ad_id = isset($body['adId']) ? (string) $body['adId'] : null;
        $ad->remote_tracking = is_array($tracking) ? $tracking : [];

        return $ad;
    }

    /**
     * A short-lived HS256 bearer token scoping the request to the `music`
     * tenant. Mirrors the verifier in the KIKI app's service-token helper.
     */
    private function requestWithAuth(): PendingRequest
    {
        $now = time();
        $header = self::base64Url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body = self::base64Url(json_encode([
            'iss' => 'keekii-music',
            'tenantId' => 't1',
            'iat' => $now,
            'exp' => $now + 60,
        ]));
        $signature = self::base64Url(
            hash_hmac(
                'sha256',
                "$header.$body",
                (string) config('keekii-ads.secret'),
                true,
            ),
        );

        return Http::baseUrl(rtrim((string) config('keekii-ads.base_url'), '/'))
            ->timeout((int) config('keekii-ads.timeout', 2))
            ->acceptJson()
            ->withToken("$header.$body.$signature")
            ->withHeaders(['X-Request-Id' => (string) Str::uuid()]);
    }

    private static function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
