<?php

namespace App\Jobs;

use App\Models\Track;
use App\Services\AudioAnalysis\AudioAnalyzer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * Analyses a track's audio after ingest: BPM, musical key, and — when the
 * client hasn't already uploaded one — waveform peak bars served through the
 * existing WaveController (waves/{id}.json).
 *
 * Every step degrades to "leave the data untouched": no value is ever
 * fabricated, and sources without a local audio file (provider streams, CDN
 * storage) are skipped with an explicit log line.
 */
class AnalyzeTrackAudioJob implements ShouldQueue
{
    use Queueable;

    // hard cap on decoded audio: covers any ordinary track and bounds both
    // the PCM string in memory and the analysis runtime
    public const MAX_ANALYSIS_SECONDS = 1800;

    protected Track $track;

    public function __construct(Track $track)
    {
        $this->track = $track;
    }

    public function handle(): void
    {
        $track = $this->track;

        try {
            $path = $this->resolveLocalPath($track->src);
            if (!$path) {
                Log::info(
                    "AnalyzeTrackAudioJob: track {$track->id} has no local audio file (provider stream or remote storage); leaving bpm/key/waveform untouched.",
                );
                return;
            }

            $ffmpeg = (string) (settings('player.ffmpeg_binary')
                ?: '/usr/bin/ffmpeg');
            if (!is_file($ffmpeg) || !is_executable($ffmpeg)) {
                Log::info(
                    "AnalyzeTrackAudioJob: ffmpeg not available at {$ffmpeg}; leaving bpm/key/waveform untouched for track {$track->id}.",
                );
                return;
            }

            $extractStart = microtime(true);
            $pcm = $this->extractPcm($ffmpeg, $path);
            $extractSeconds = microtime(true) - $extractStart;
            if ($pcm === null || strlen($pcm) < 2 * AudioAnalyzer::SAMPLE_RATE) {
                Log::info(
                    "AnalyzeTrackAudioJob: no usable PCM for track {$track->id}; leaving bpm/key/waveform untouched.",
                );
                return;
            }

            $sampleRate = AudioAnalyzer::SAMPLE_RATE;
            $audioSeconds = round(strlen($pcm) / 2 / $sampleRate, 1);

            $analysisStart = microtime(true);
            $result = AudioAnalyzer::analyze($pcm, $sampleRate);
            $analysisSeconds = microtime(true) - $analysisStart;

            // only write values the analysis actually produced; a failed
            // detection never overwrites previously good data with null
            $update = [];
            if ($result['bpm'] !== null) {
                $update['bpm'] = $result['bpm'];
            }
            if ($result['key'] !== null) {
                $update['musical_key'] = $result['key'];
            }
            if ($update) {
                $track->update($update);
            }

            // waveform peaks — only when the client-side generator hasn't
            // already stored a wave for this track (see CrupdateTrack)
            $waveDisk = $track->getWaveStorageDisk();
            $wavePath = "waves/{$track->id}.json";
            if (!$waveDisk->exists($wavePath)) {
                $bars = AudioAnalyzer::waveformBars($pcm, $sampleRate);
                if ($bars) {
                    $waveDisk->put($wavePath, json_encode($bars));
                }
            }

            Log::info(sprintf(
                'AnalyzeTrackAudioJob: track %d done in %.2fs total (extract %.2fs, analysis %.2fs, audio %ss, bpm=%s, key=%s)',
                $track->id,
                $extractSeconds + $analysisSeconds,
                $extractSeconds,
                $analysisSeconds,
                $audioSeconds,
                $result['bpm'] ?? 'n/a',
                $result['key'] ?? 'n/a',
            ));
        } catch (\Throwable $e) {
            Log::error(
                "AnalyzeTrackAudioJob failed for track {$this->track->id}: {$e->getMessage()}",
            );
        }
    }

    /**
     * Map the track's src URL to a file on this machine. Uploaded files
     * (relative, same-app, or symlinked storage URLs) resolve; provider
     * streams and remote storage do not, and those are reported honestly as
     * "no analysis" rather than being fetched.
     */
    protected function resolveLocalPath(?string $src): ?string
    {
        if (!$src) {
            return null;
        }
        $path = parse_url($src, PHP_URL_PATH);
        if (!$path) {
            return null;
        }
        $relative = ltrim($path, '/');
        if ($relative === '') {
            return null;
        }

        $candidates = [
            public_path($relative),
            base_path('public/' . $relative),
            storage_path('app/' . $relative),
        ];
        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    protected function extractPcm(string $ffmpeg, string $path): ?string
    {
        $process = new Process([
            $ffmpeg,
            '-v',
            'error',
            '-nostdin',
            '-t',
            (string) self::MAX_ANALYSIS_SECONDS,
            '-i',
            $path,
            '-ac',
            '1',
            '-ar',
            (string) AudioAnalyzer::SAMPLE_RATE,
            '-f',
            's16le',
            '-',
        ]);
        $process->setTimeout(45);

        try {
            $process->mustRun();
        } catch (\Throwable $e) {
            Log::warning(
                "AnalyzeTrackAudioJob: ffmpeg extraction failed for {$path}: {$e->getMessage()}",
            );
            return null;
        }

        $out = $process->getOutput();
        return $out === '' ? null : $out;
    }
}
