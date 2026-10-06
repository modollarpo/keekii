<?php

namespace App\Services\Ads;

use App\Models\Ad;
use App\Models\AdPlay;
use Illuminate\Support\Facades\Auth;
use Jenssegers\Agent\Agent;

/**
 * Writes the append-only impression log behind ad reporting.
 *
 * Deliberately modelled on App\Services\Tracks\LogTrackPlay rather than
 * reusing it: that class is live production code for track reporting, and the
 * three device/location helpers below are the whole of the overlap. The flow
 * differs where ads differ - an impression is opened when the creative loads
 * and closed later with an outcome, because a creative can load and then
 * never finish (load stall, playback cap, the listener picking another
 * track), and that case has to stay visible as an impression that never
 * finished rather than disappear.
 */
class LogAdPlay
{
    /**
     * Open an impression. Called once the creative has actually loaded, which
     * is the point at which it is on screen.
     */
    public function start(Ad $ad): AdPlay
    {
        $agent = app(Agent::class);

        $play = $ad->plays()->create([
            'location' => $this->getLocation(),
            'platform' => strtolower($agent->platform()),
            'device' => $this->getDevice(),
            'browser' => strtolower($agent->browser()),
            'user_id' => Auth::id(),
        ]);

        Ad::where('id', $ad->id)->increment('impressions');

        return $play;
    }

    /**
     * Close an impression with how it ended. Idempotent, so a duplicated
     * request cannot double count a completion or a skip.
     */
    public function finish(AdPlay $play, string $outcome): void
    {
        if ($play->outcome !== null) {
            return;
        }

        $play->outcome = $outcome;
        $play->save();

        $column = $outcome === AdPlay::OUTCOME_COMPLETED
            ? 'completions'
            : 'skips';
        Ad::where('id', $play->ad_id)->increment($column);
    }

    private function getDevice(): string
    {
        $agent = app(Agent::class);
        if ($agent->isMobile()) {
            return 'mobile';
        } elseif ($agent->isTablet()) {
            return 'tablet';
        }

        return 'desktop';
    }

    private function getLocation(): string
    {
        return strtolower(geoip(getIp())['iso_code']);
    }
}
