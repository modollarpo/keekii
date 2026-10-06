<?php

namespace App\Policies;

use App\Models\Ad;
use App\Models\User;
use Common\Core\Policies\BasePolicy;

class AdPolicy extends BasePolicy
{
    public function index(?User $user)
    {
        return $this->hasPermission($user, 'ads.view');
    }

    public function show(?User $user)
    {
        return $this->hasPermission($user, 'ads.view');
    }

    public function store(User $user)
    {
        return $this->hasPermission($user, 'ads.create');
    }

    public function update(User $user)
    {
        return $this->hasPermission($user, 'ads.update');
    }

    public function destroy(User $user, mixed $ids = null)
    {
        return $this->hasPermission($user, 'ads.delete');
    }
}
