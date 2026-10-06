<?php

return [
    'wave_storage_disk' => env('WAVE_STORAGE_DISK'),

    'upload_types' => [
        'media' => [
            'visibility' => 'public',
            'label' => 'Media',
            'description' => 'Uploaded audio and video files',
            'defaults' => [
                'prefix' => 'media',
                'accept' => [],
                'max_file_size' => '10485760', // 10MB
            ],
        ],
        'artwork' => [
            'visibility' => 'public',
            'label' => 'Artwork',
            'description' =>
                'Artwork and other images for tracks, playlists, artists and albums.',
            'defaults' => [
                'prefix' => 'artwork',
                'accept' => ['image'],
                'max_file_size' => '1048576',
            ],
        ],
        'backstageAttachments' => [
            'visibility' => 'private',
            'label' => 'Backstage attachments',
            'description' => 'Attachments for backstage requests.',
            'defaults' => [
                'prefix' => 'backstage-attachments',
                'max_file_size' => '5242880', // 5MB
            ],
        ],
        'ads' => [
            'visibility' => 'public',
            'label' => 'Player ads',
            'description' =>
                'Video, image and voiceover creatives for player ads.',
            'defaults' => [
                'prefix' => 'ads',
                'accept' => ['image', 'video', 'audio'],
                'max_file_size' => '536870912', // 512MB
            ],
        ],
    ],
];
