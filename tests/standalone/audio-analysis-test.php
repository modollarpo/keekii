<?php

/**
 * Dependency-free assertions for App\Services\AudioAnalysis\AudioAnalyzer.
 * The repo ships no PHPUnit, so this standalone runner gives the analysis
 * math real, executable coverage (and real timing numbers):
 *
 *   php tests/standalone/audio-analysis-test.php
 *
 * Exit code 0 = all passed.
 */

require __DIR__ . '/../../vendor/autoload.php';

use App\Services\AudioAnalysis\AudioAnalyzer;

$failures = 0;
$total = 0;

function check(string $name, bool $ok, string $detail = ''): void
{
    global $failures, $total;
    $total++;
    if ($ok) {
        echo "  ok   {$name}\n";
    } else {
        $failures++;
        echo "  FAIL {$name}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
    }
}

/** Build s16le PCM from samples in -1..1. */
function pcm(array $samples): string
{
    $out = '';
    foreach ($samples as $s) {
        $v = (int) round($s * 32767);
        if ($v < 0) {
            $v += 65536;
        }
        $out .= pack('v', $v & 0xFFFF);
    }
    return $out;
}

/** Impulse train at a constant tempo: 10-sample bursts every 60/$bpm s. */
function clicks(float $seconds, float $bpm, int $rate = AudioAnalyzer::SAMPLE_RATE): string
{
    $interval = 60.0 / $bpm;
    $n = (int) ($seconds * $rate);
    $samples = array_fill(0, $n, 0.0);
    for ($t = 0.0; $t < $seconds; $t += $interval) {
        $start = (int) ($t * $rate);
        for ($i = 0; $i < 10 && $start + $i < $n; $i++) {
            $samples[$start + $i] = 0.9;
        }
    }
    return pcm($samples);
}

function tone(float $freq, float $seconds, float $amp = 0.8, int $rate = AudioAnalyzer::SAMPLE_RATE): string
{
    $n = (int) ($seconds * $rate);
    $samples = [];
    for ($i = 0; $i < $n; $i++) {
        $samples[] = $amp * sin(2 * M_PI * $freq * $i / $rate);
    }
    return pcm($samples);
}

function chord(array $freqs, float $seconds, int $rate = AudioAnalyzer::SAMPLE_RATE): string
{
    $n = (int) ($seconds * $rate);
    $samples = array_fill(0, $n, 0.0);
    foreach ($freqs as $f) {
        for ($i = 0; $i < $n; $i++) {
            $samples[$i] += 0.6 / count($freqs) * sin(2 * M_PI * $f * $i / $rate);
        }
    }
    return pcm($samples);
}

echo "AudioAnalyzer standalone tests\n";

// --- BPM -----------------------------------------------------------------
foreach ([120.0, 90.0, 174.0] as $bpm) {
    $t0 = microtime(true);
    $est = AudioAnalyzer::estimateBpm(clicks(30, $bpm));
    $ms = (microtime(true) - $t0) * 1000;
    printf(
        "  (30s click track @ %.0f BPM -> %s in %.0f ms)\n",
        $bpm,
        $est === null ? 'null' : sprintf('%.2f', $est),
        $ms,
    );
    check(
        sprintf('bpm detects %.0f clicks', $bpm),
        $est !== null && abs($est - $bpm) <= 1.5,
        'got ' . var_export($est, true),
    );
}

check(
    'bpm returns null for near-silence',
    AudioAnalyzer::estimateBpm(pcm(array_fill(0, AudioAnalyzer::SAMPLE_RATE, 0.0))) === null,
);

// --- key -----------------------------------------------------------------
$sine = tone(440.0, 12); // A4
$keyA = AudioAnalyzer::estimateKey($sine);
check(
    'key detects A from A4 sine',
    $keyA !== null && str_starts_with($keyA, 'A '),
    'got ' . var_export($keyA, true),
);

$am = chord([220.0, 261.6256, 329.6276], 12); // A minor triad
$keyAm = AudioAnalyzer::estimateKey($am);
check(
    'key detects A minor from A-C-E triad',
    $keyAm !== null && str_starts_with($keyAm, 'A '),
    'got ' . var_export($keyAm, true),
);

$cmaj = chord([261.6256, 329.6276, 391.9954], 12); // C major triad
$keyC = AudioAnalyzer::estimateKey($cmaj);
check(
    'key detects C from C-E-G triad',
    $keyC !== null && str_starts_with($keyC, 'C '),
    'got ' . var_export($keyC, true),
);

check(
    'key returns null for near-silence',
    AudioAnalyzer::estimateKey(pcm(array_fill(0, 10 * AudioAnalyzer::SAMPLE_RATE, 0.0))) === null,
);

// combined analyze() call with real timing (the number to quote in reports)
$pcm = clicks(30, 128);
$t0 = microtime(true);
$result = AudioAnalyzer::analyze($pcm);
$ms = (microtime(true) - $t0) * 1000;
printf("  (analyze() on 30s of audio: %.0f ms, bpm=%s key=%s)\n", $ms, $result['bpm'] ?? 'null', $result['key'] ?? 'null');
check('analyze() returns both fields', $result['bpm'] !== null && $result['key'] !== null);

// --- waveform ------------------------------------------------------------
$bars = AudioAnalyzer::waveformBars(chord([220.0, 261.6256, 329.6276], 10));
check('waveform bar count is 414', count($bars) === 414, 'got ' . count($bars));

$shapeOk = true;
$shapeDetail = '';
foreach ($bars as $idx => $bar) {
    $j = $idx * AudioAnalyzer::BAR_WIDTH;
    [$x, $y, $w, $h] = $bar;
    if (abs($w - 1.5) > 1e-9 || abs($x - ($j + 0.75)) > 1e-9 || $h < 1 || abs(($y + $h) - AudioAnalyzer::WAVE_HEIGHT) > 1e-6) {
        $shapeOk = false;
        $shapeDetail = "bar {$idx}: " . json_encode($bar);
        break;
    }
}
check('waveform bar geometry matches client format', $shapeOk, $shapeDetail);

$silent = AudioAnalyzer::waveformBars(pcm(array_fill(0, 10 * AudioAnalyzer::SAMPLE_RATE, 0.0)));
check(
    'silent waveform falls back to baseline bars',
    count($silent) === 414 && abs($silent[0][3] - 1.0) < 1e-9,
);

$json = json_encode($bars);
check('waveform bars are JSON-encodable', $json !== false && strlen($json) > 1000);

echo $failures === 0
    ? "\nALL {$total} PASSED\n"
    : "\n{$failures}/{$total} FAILED\n";
exit($failures === 0 ? 0 : 1);
