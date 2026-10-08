<?php

namespace App\Services\AudioAnalysis;

/**
 * Pure-PHP audio analysis used by AnalyzeTrackAudioJob. Everything operates
 * on raw s16le mono PCM so it can be exercised without ffmpeg, Laravel or
 * the database (see tests/standalone/audio-analysis-test.php).
 *
 * - BPM: onset-envelope (frame energy derivative) autocorrelation with
 *   parabolic peak refinement, searching a 60-180 BPM range.
 * - Key: magnitude chromagram (radix-2 FFT) correlated against the 24
 *   Krumhansl-Schmuckler major/minor profiles.
 * - Waveform bars: same geometry and math as the client-side generator in
 *   resources/client/web-player/tracks/waveform/generate-waveform-data.ts,
 *   so server-generated and client-generated waves render identically.
 */
class AudioAnalyzer
{
    public const SAMPLE_RATE = 22050;

    // waveform geometry — keep in sync with generate-waveform-data.ts
    public const WAVE_WIDTH = 1240;
    public const WAVE_HEIGHT = 45.0;
    public const BAR_WIDTH = 3;
    public const BAR_GAP = 0.5;

    private const FFT_SIZE = 2048;
    private const CHROMA_HOP = 1024;
    private const MAX_CHROMA_FRAMES = 200;
    private const BPM_MIN = 60.0;
    private const BPM_MAX = 180.0;
    private const MIN_ANALYSIS_SECONDS = 5.0;
    private const KEY_MIN_CORRELATION = 0.35;

    // Krumhansl-Schmuckler key profiles, keyed from C.
    private const MAJOR_PROFILE = [
        6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29,
        2.88,
    ];
    private const MINOR_PROFILE = [
        6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34,
        3.17,
    ];
    private const NOTE_NAMES = [
        'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
    ];

    /**
     * @return array{bpm: float|null, key: string|null}
     */
    public static function analyze(
        string $pcm,
        int $sampleRate = self::SAMPLE_RATE,
    ): array {
        return [
            'bpm' => self::estimateBpm($pcm, $sampleRate),
            'key' => self::estimateKey($pcm, $sampleRate),
        ];
    }

    public static function estimateBpm(
        string $pcm,
        int $sampleRate = self::SAMPLE_RATE,
    ): ?float {
        $envelope = self::onsetEnvelope($pcm, $sampleRate);
        $frames = count($envelope);
        $fps = $sampleRate / self::hopSize();

        // need at least a couple of bars worth of lags to correlate
        $minLag = 60 * $fps / self::BPM_MAX;
        $maxLag = 60 * $fps / self::BPM_MIN;
        if ($frames < (int) ceil($maxLag) * 2 || $frames < 64) {
            return null;
        }

        // zero-mean so the autocorrelation isn't dominated by the envelope's
        // DC level
        $mean = array_sum($envelope) / $frames;
        $env = array_map(fn($v) => $v - $mean, $envelope);

        // score on a 0.25-frame grid: tempo periods are rarely integer
        // (e.g. 120 BPM at 43.07 fps = 21.53 frames) and plain integer-lag
        // scoring misaligns narrow onset spikes enough to lock onto the
        // double period instead
        $grid = 0.25;
        $bestScore = -INF;
        $bestLag = 0.0;
        $bestKey = 0;
        for ($k = 0; ; $k++) {
            $lag = $minLag + $k * $grid;
            if ($lag > $maxLag) {
                break;
            }
            $r = self::fractionalScore($env, $lag);
            if ($r > $bestScore) {
                $bestScore = $r;
                $bestLag = $lag;
                $bestKey = $k;
            }
        }

        if ($bestScore <= 0.0) {
            return null;
        }

        // parabolic refinement around the peak on the grid
        $y0 = self::fractionalScore($env, $minLag + ($bestKey - 1) * $grid);
        $y1 = $bestScore;
        $y2 = self::fractionalScore($env, $minLag + ($bestKey + 1) * $grid);
        $denom = $y0 - 2 * $y1 + $y2;
        if (abs($denom) > 1e-12) {
            $bestLag += 0.5 * $grid * ($y0 - $y2) / $denom;
        }

        // octave guard: a 120 BPM train peaks hardest at its 60 BPM double
        // period (2 full cycles align better than the fractional one), but
        // its half-lag still carries most of the score — a true slow track
        // has ~no half-lag correlation. Prefer the faster tempo when the
        // half-lag holds up.
        $halfLag = $bestLag / 2;
        if ($halfLag >= $minLag) {
            $halfScore = self::fractionalScore($env, $halfLag);
            if ($halfScore >= 0.65 * $bestScore) {
                $bestLag = $halfLag;
            }
        }

        if ($bestLag <= 0) {
            return null;
        }

        $bpm = 60 * $fps / $bestLag;
        if ($bpm < self::BPM_MIN * 0.5 || $bpm > self::BPM_MAX * 1.5) {
            return null;
        }

        return round($bpm, 2);
    }

    /**
     * Pearson-style autocorrelation of the onset envelope at an arbitrary
     * (fractional) lag, with linear interpolation of the shifted side.
     *
     * @param array<int, float> $env
     */
    private static function fractionalScore(array $env, float $lag): float
    {
        $frames = count($env);
        $base = (int) floor($lag);
        $frac = $lag - $base;
        $n = $frames - $base - 1;
        if ($n < 8) {
            return 0.0;
        }

        $num = 0.0;
        $e1 = 0.0;
        $e2 = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $a = $env[$i];
            $b = $env[$i + $base] + $frac * ($env[$i + $base + 1] - $env[$i + $base]);
            $num += $a * $b;
            $e1 += $a * $a;
            $e2 += $b * $b;
        }
        $den = sqrt($e1 * $e2);

        return $den > 0 ? $num / $den : 0.0;
    }

    public static function estimateKey(
        string $pcm,
        int $sampleRate = self::SAMPLE_RATE,
    ): ?string {
        $chroma = self::chromaVector($pcm, $sampleRate);
        if (!$chroma) {
            return null;
        }

        $bestRoot = 0;
        $bestMode = 'major';
        $bestCorrelation = -1.0;
        foreach (self::NOTE_NAMES as $root => $name) {
            foreach (['major', 'minor'] as $mode) {
                $profile =
                    $mode === 'major'
                        ? self::MAJOR_PROFILE
                        : self::MINOR_PROFILE;
                $rotated = [];
                for ($i = 0; $i < 12; $i++) {
                    $rotated[] = $profile[($i - $root + 12) % 12];
                }
                $r = self::pearson($chroma, $rotated);
                if ($r > $bestCorrelation) {
                    $bestCorrelation = $r;
                    $bestRoot = $root;
                    $bestMode = $mode;
                }
            }
        }

        if ($bestCorrelation < self::KEY_MIN_CORRELATION) {
            return null;
        }

        return self::NOTE_NAMES[$bestRoot] . ' ' . $bestMode;
    }

    /**
     * Build waveform bars in the exact format produced by the client-side
     * generator (number[][] of [x, y, width, height]).
     *
     * @return array<int, array{0: float, 1: float, 2: float, 3: float}>
     */
    public static function waveformBars(
        string $pcm,
        int $sampleRate = self::SAMPLE_RATE,
    ): array {
        $totalSamples = intdiv(strlen($pcm), 2);
        $sectionLen = intdiv($totalSamples, self::WAVE_WIDTH);
        if ($sectionLen < 1 || $totalSamples < 1) {
            return [];
        }

        // one value per measured section (every BAR_WIDTH-th section, exactly
        // like the client loop), each scaled by the same normalizer
        $bars = [];
        $maxVal = 0.0;
        for ($j = 0; $j < self::WAVE_WIDTH; $j += self::BAR_WIDTH) {
            $sum = 0;
            $offset = $j * $sectionLen;
            $samples = self::readUnsignedSamples(
                $pcm,
                $offset,
                $sectionLen,
            );
            foreach ($samples as $s) {
                $sum += $s * $s;
            }
            // the client divides each section's energy by the FULL channel
            // length (see bufferMeasure in generate-waveform-data.ts); the
            // shared normalizer below cancels the int16 vs float scale
            $val = sqrt($sum / $totalSamples) * 10000;
            $bars[$j] = $val;
            if ($val > $maxVal) {
                $maxVal = $val;
            }
        }

        $out = [];
        $width = self::BAR_WIDTH * abs(1 - self::BAR_GAP);
        $scale = $maxVal > 0 ? self::WAVE_HEIGHT / $maxVal : 0;
        foreach ($bars as $j => $val) {
            $h = $val * $scale + 1;
            $out[] = [
                $j + $width / 2,
                self::WAVE_HEIGHT - $h,
                $width,
                $h,
            ];
        }

        return $out;
    }

    // ------------------------------------------------------------------
    // onset envelope
    // ------------------------------------------------------------------

    private static function hopSize(): int
    {
        return 512;
    }

    /**
     * Frame energy derivative, mean-removed and half-wave rectified.
     *
     * @return array<int, float>
     */
    private static function onsetEnvelope(
        string $pcm,
        int $sampleRate,
    ): array {
        $frameSize = 1024;
        $hop = self::hopSize();
        $totalSamples = intdiv(strlen($pcm), 2);
        $frameCount = $totalSamples > $frameSize
            ? intdiv($totalSamples - $frameSize, $hop) + 1
            : 0;
        if ($frameCount < 2) {
            return [];
        }

        $energy = [];
        for ($f = 0; $f < $frameCount; $f++) {
            $samples = self::readUnsignedSamples(
                $pcm,
                $f * $hop,
                $frameSize,
            );
            $sum = 0;
            foreach ($samples as $s) {
                $sum += $s * $s;
            }
            $energy[] = (float) $sum;
        }

        // raw positive derivative of the energy contour
        $onsets = [];
        for ($f = 1; $f < $frameCount; $f++) {
            $d = $energy[$f] - $energy[$f - 1];
            $onsets[] = $d > 0 ? $d : 0.0;
        }

        // remove the slow-moving local mean (1 second window) so only
        // transient rises survive, then rectify again
        $fps = $sampleRate / $hop;
        $maWindow = max(1, (int) round($fps));
        $out = [];
        $running = 0.0;
        $queue = [];
        foreach ($onsets as $v) {
            $queue[] = $v;
            $running += $v;
            if (count($queue) > $maWindow) {
                $running -= array_shift($queue);
            }
            $d = $v - $running / count($queue);
            $out[] = $d > 0 ? $d : 0.0;
        }

        $max = $out ? max($out) : 0;
        if ($max > 0) {
            $out = array_map(fn($v) => $v / $max, $out);
        }

        return $out;
    }

    // ------------------------------------------------------------------
    // chroma / key
    // ------------------------------------------------------------------

    /**
     * Average magnitude chromagram over up to MAX_CHROMA_FRAMES evenly
     * sampled frames of the track.
     *
     * @return array<int, float>|null normalized to sum 1
     */
    private static function chromaVector(
        string $pcm,
        int $sampleRate,
    ): ?array {
        $n = self::FFT_SIZE;
        $hop = self::CHROMA_HOP;
        $totalSamples = intdiv(strlen($pcm), 2);
        $frameCount = $totalSamples > $n
            ? intdiv($totalSamples - $n, $hop) + 1
            : 0;
        if ($frameCount < 4) {
            return null;
        }
        $duration = $totalSamples / $sampleRate;
        if ($duration < self::MIN_ANALYSIS_SECONDS) {
            return null;
        }

        $step = max(1, intdiv($frameCount, self::MAX_CHROMA_FRAMES));
        $chroma = array_fill(0, 12, 0.0);
        $window = self::hannWindow($n);

        for ($f = 0; $f < $frameCount; $f += $step) {
            $samples = self::readSignedSamples($pcm, $f * $hop, $n);
            if (count($samples) < $n) {
                break;
            }

            $re = [];
            $im = [];
            for ($i = 0; $i < $n; $i++) {
                $re[] = $samples[$i] * $window[$i];
                $im[] = 0.0;
            }
            $mags = self::fftMagnitudes($re, $im);

            // per-frame magnitude peak: skip near-silent frames so hiss
            // doesn't smear the chromagram
            $frameMax = 0.0;
            foreach ($mags as $m) {
                if ($m > $frameMax) {
                    $frameMax = $m;
                }
            }
            if ($frameMax <= 0) {
                continue;
            }

            $half = intdiv($n, 2);
            for ($k = 1; $k < $half; $k++) {
                $mag = $mags[$k];
                if ($mag < $frameMax * 0.02) {
                    continue;
                }
                $freq = $k * $sampleRate / $n;
                if ($freq < 55.0 || $freq > 2000.0) {
                    continue;
                }
                $midi = 69 + 12 * log($freq / 440.0, 2);
                $pc = ((int) floor($midi + 0.5)) % 12;
                $chroma[$pc] += $mag;
            }
        }

        $total = array_sum($chroma);
        if ($total <= 0) {
            return null;
        }

        return array_map(fn($v) => $v / $total, $chroma);
    }

    /**
     * @param array<int, float> $a
     * @param array<int, float> $b
     */
    private static function pearson(array $a, array $b): float
    {
        $n = count($a);
        $sumA = array_sum($a);
        $sumB = array_sum($b);
        $meanA = $sumA / $n;
        $meanB = $sumB / $n;
        $num = 0.0;
        $denA = 0.0;
        $denB = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $da = $a[$i] - $meanA;
            $db = $b[$i] - $meanB;
            $num += $da * $db;
            $denA += $da * $da;
            $denB += $db * $db;
        }
        $den = sqrt($denA * $denB);
        return $den > 0 ? $num / $den : 0.0;
    }

    // ------------------------------------------------------------------
    // FFT + helpers
    // ------------------------------------------------------------------

    /**
     * Iterative in-place radix-2 Cooley-Tukey FFT; returns magnitudes.
     *
     * @param array<int, float> $re
     * @param array<int, float> $im
     * @return array<int, float>
     */
    private static function fftMagnitudes(array $re, array $im): array
    {
        $n = count($re);

        // bit-reversal permutation
        for ($i = 1, $j = 0; $i < $n; $i++) {
            $bit = $n >> 1;
            for (; $j & $bit; $bit >>= 1) {
                $j ^= $bit;
            }
            $j ^= $bit;
            if ($i < $j) {
                $tmp = $re[$i];
                $re[$i] = $re[$j];
                $re[$j] = $tmp;
                $tmp = $im[$i];
                $im[$i] = $im[$j];
                $im[$j] = $tmp;
            }
        }

        for ($len = 2; $len <= $n; $len <<= 1) {
            $angle = -2 * M_PI / $len;
            $wRe = cos($angle);
            $wIm = sin($angle);
            $halfLen = $len >> 1;
            for ($i = 0; $i < $n; $i += $len) {
                $curRe = 1.0;
                $curIm = 0.0;
                for ($k = 0; $k < $halfLen; $k++) {
                    $uRe = $re[$i + $k];
                    $uIm = $im[$i + $k];
                    $j = $i + $k + $halfLen;
                    $vRe = $re[$j] * $curRe - $im[$j] * $curIm;
                    $vIm = $re[$j] * $curIm + $im[$j] * $curRe;
                    $re[$i + $k] = $uRe + $vRe;
                    $im[$i + $k] = $uIm + $vIm;
                    $re[$j] = $uRe - $vRe;
                    $im[$j] = $uIm - $vIm;
                    $nextRe = $curRe * $wRe - $curIm * $wIm;
                    $curIm = $curRe * $wIm + $curIm * $wRe;
                    $curRe = $nextRe;
                }
            }
        }

        $mags = [];
        for ($i = 0; $i < $n; $i++) {
            $mags[] = sqrt($re[$i] * $re[$i] + $im[$i] * $im[$i]);
        }

        return $mags;
    }

    /**
     * @return array<int, float>
     */
    private static function hannWindow(int $n): array
    {
        $w = [];
        for ($i = 0; $i < $n; $i++) {
            $w[] = 0.5 - 0.5 * cos(2 * M_PI * $i / ($n - 1));
        }

        return $w;
    }

    /**
     * Read $count int16 samples starting at sample $offset. The sign bit is
     * irrelevant for squared-energy math in some callers, but unpacking here
     * always returns signed values for correctness.
     *
     * @return array<int, int>
     */
    private static function readSignedSamples(
        string $pcm,
        int $offset,
        int $count,
    ): array {
        $bytes = $count * 2;
        if ($offset * 2 >= strlen($pcm)) {
            return [];
        }
        $chunk = substr($pcm, $offset * 2, $bytes);
        if ($chunk === '' || $chunk === false) {
            return [];
        }
        $raw = unpack('v*', $chunk);
        if ($raw === false) {
            return [];
        }
        $out = [];
        foreach ($raw as $v) {
            $out[] = $v >= 0x8000 ? $v - 0x10000 : $v;
        }

        return $out;
    }

    /**
     * Sign is irrelevant for sum-of-squares callers; kept separate from the
     * signed reader only to make that intent explicit.
     *
     * @return array<int, int>
     */
    private static function readUnsignedSamples(
        string $pcm,
        int $offset,
        int $count,
    ): array {
        return self::readSignedSamples($pcm, $offset, $count);
    }
}
