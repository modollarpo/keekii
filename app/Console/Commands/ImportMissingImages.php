<?php

namespace App\Console\Commands;

use App\Models\Track;
use App\Services\Providers\Deezer\DeezerTrack;
use Illuminate\Console\Command;

class ImportMissingImages extends Command
{
    protected $signature =
        'music:import-missing-images
            {--limit=0 : 0 = process all qualifying tracks}
            {--pause=0.3 : pause seconds between API calls}
            {--dry-run : do not write to the database}
            {--ids= : comma-separated list of track ids to process}';

    protected $description =
        'Fill missing track images from Deezer. Tracks with a deezer_id but no local image are filled. Idempotent: existing images are skipped.';

    public function handle(): void
    {
        $limit = (int) $this->option('limit');
        $pause = (float) $this->option('pause');
        $dryRun = (bool) $this->option('dry-run');
        $ids = $this->option('ids');

        $query = Track::query()
            ->where(function ($q) {
                $q->whereNull('image')
                    ->orWhere('image', '');
            })
            ->whereNotNull('deezer_id');

        if (!empty($ids)) {
            $idsArr = array_filter(array_map('intval', explode(',', $ids)));
            $query->whereIn('id', $idsArr);
        }

        $total = $query->count();

        if ($total === 0) {
            $this->info('No tracks missing images.');
            return;
        }

        $toProcess = $limit > 0 ? $query->take($limit)->pluck('id') : $query->pluck('id');
        $count = $toProcess->count();

        $this->output->progressStart($count);
        $imported = 0;
        $skipped = 0;
        $errors = 0;

        $service = new DeezerTrack();

        foreach ($toProcess as $id) {
            $track = Track::find($id);
            if (!$track) {
                $errors++;
                $this->output->progressAdvance();
                continue;
            }

            // skip if already has an image in raw attributes
            $rawImage = $track->getRawOriginal('image');
            if (!empty($rawImage)) {
                $skipped++;
                $this->output->progressAdvance();
                continue;
            }

            $coverUrl = $service->imageFor($track->deezer_id);

            if ($coverUrl === null) {
                $errors++;
                $this->output->progressAdvance();
                continue;
            }

            if (!$dryRun) {
                $track->image = $coverUrl;
                $track->saveQuietly();
            }

            $imported++;
            $this->output->progressAdvance();

            if ($pause > 0) {
                usleep((int) ($pause * 1_000_000));
            }
        }

        $this->output->progressFinish();

        $mode = $dryRun ? ' [DRY RUN]' : '';
        $this->info("Done{$mode}: imported {$imported} / {$count} tracks (skipped {$skipped}, errors {$errors}).");
    }
}