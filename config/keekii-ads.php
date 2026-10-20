<?php

// KIKI ad network (remote fill). When enabled, the pre-roll slot is filled by
// the KIKI ad server instead of the locally managed `ads` table.
//
// Both values are read from the environment and default to null, so an
// unconfigured install keeps serving its local ads exactly as before.
return [
    // Base URL of the KIKI ad server, without a trailing slash. The client
    // only talks to /api/ads/request and the signed tracking URLs it returns.
    'base_url' => env('KIKI_ADS_BASE_URL'),

    // Shared secret used to mint the HS256 service token that authorises
    // /api/ads/request. Must match SERVICE_JWT_SECRET on the KIKI side.
    'secret' => env('KIKI_ADS_SECRET'),

    // Placement this app asks for. Resolves server-side to the `music`
    // publisher and `preroll` slot.
    'property' => env('KIKI_ADS_PROPERTY', 'music'),

    // Seconds a single request may take before the pre-roll is given up and
    // the real track is allowed to play. Ads must never hold up playback.
    'timeout' => (int) env('KIKI_ADS_TIMEOUT', 2),
];
