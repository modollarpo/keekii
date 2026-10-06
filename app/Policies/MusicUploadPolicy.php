<?php

namespace App\Policies;

use App\Models\User;
use Common\Core\Policies\FileEntryPolicy;

class MusicUploadPolicy extends FileEntryPolicy
{
    public function store(
        ?User $user,
        mixed $parentId = null,
        string|null $uploadType = null,
    ): bool {
        if (!$uploadType) {
            $uploadType = request('uploadType');
        }

        if (
            in_array($uploadType, ['media', 'artwork']) &&
            ($this->hasPermission($user, 'music.create') ||
                $this->hasPermission($user, 'music.update'))
        ) {
            return true;
        }

        if (
            $uploadType === 'backstageAttachments' &&
            $this->hasPermission($user, 'backstageRequests.create')
        ) {
            return true;
        }

        if (
            $uploadType === 'ads' &&
            ($this->hasPermission($user, 'ads.create') ||
                $this->hasPermission($user, 'ads.update'))
        ) {
            return true;
        }

        return parent::store($user, $parentId, $uploadType);
    }
}
