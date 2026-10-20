<?php

/**
 * Dependency-free checks for App\Services\Ads\AdNetworkClient.
 *
 *   php tests/standalone/ad-network-client-test.php
 */

require __DIR__ . '/../../vendor/autoload.php';

use App\Services\Ads\AdNetworkClient;
use Illuminate\Contracts\Console\Kernel;

$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$failures = 0;
$total = 0;

function check(string $name, bool $ok, string $detail = ''): void
{
    global $failures, $total;
    $total++;
    if ($ok) {
        echo "  ok   {$name}\n";
        return;
    }
    $failures++;
    echo "  FAIL {$name}\n";
    if ($detail !== '') {
        echo "       {$detail}\n";
    }
}

echo "AdNetworkClient standalone checks\n";

$client = app(AdNetworkClient::class);

check('not configured by default (missing base_url/secret)', $client->isConfigured() === false, 'Set KIKI_ADS_BASE_URL and KIKI_ADS_SECRET to exercise the network path');
check('request returns null when unconfigured', $client->request() === null);
check('request returns null with arbitrary contentId when unconfigured', $client->request('track_1', ['logged_in' => false], ['country' => 'US']) === null);

echo "\n{$total} checks, {$failures} failures\n";
exit($failures === 0 ? 0 : 1);
