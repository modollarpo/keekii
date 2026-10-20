<?php
require_once __DIR__.'/../bootstrap/app.php';

use App\Services\Ads\AdNetworkClient;

$app = require __DIR__.'/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$client = app(AdNetworkClient::class);
if ($client->isConfigured()) {
    echo "BAD: should not be configured with empty env\n";
    exit(1);
}
$res = $client->request();
if ($res !== null) {
    echo "BAD: should return null when not configured\n";
    exit(1);
}
echo "OK: fail-open (unconfigured) passes\n";
