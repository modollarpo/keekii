<?php

namespace App\Services\Providers\Deezer;

use App\Services\Providers\DataObjects\NormalizedTrack;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;

class DeezerTrack extends DeezerBase
{
    public function get(string $deezerId): ?NormalizedTrack
    {
        if (!$deezerId) {
            return null;
        }

        $response = Http::timeout(8)->get("{$this->baseUrl}/track/$deezerId");
        $deezerTrack = $this->getResponseData($response);

        if (!Arr::get($deezerTrack, 'id')) {
            return null;
        }

        return $this->normalizer->track($deezerTrack);
    }

    /**
     * Look up the album cover for a Deezer track id.
     *
     * Uses the same cover_big -> cover_medium -> cover chain as
     * DeezerNormalizer::album() so repaired rows are indistinguishable from
     * rows written by the normal import.
     *
     * Persists the raw CDN url; the ProxiesImages accessor wraps it on read.
     */
    public function imageFor(int|string $deezerId): ?string
    {
        if (!$deezerId) {
            return null;
        }

        $response = Http::timeout(8)->get("{$this->baseUrl}/track/$deezerId");
        $track = $this->getResponseData($response);

        if (!Arr::get($track, 'id')) {
            return null;
        }

        $album = Arr::get($track, 'album');

        if (!is_array($album)) {
            return null;
        }

        return Arr::get($album, 'cover_big') ?:
            Arr::get($album, 'cover_medium') ?:
            Arr::get($album, 'cover');
    }
}