<?php

namespace App\QueryBuilders;

use App\Models\Ad;
use Common\Database\QueryBuilder\BaseQueryBuilder;
use Common\Database\QueryBuilder\Filter;
use Illuminate\Contracts\Pagination\Paginator;
use Illuminate\Database\Eloquent\Builder;

class AdsQueryBuilder extends BaseQueryBuilder
{
    protected string $model = Ad::class;

    public function paginate(): Paginator
    {
        $this->applySorting();
        $this->applySearchQuery();
        $this->loadRequestedRelations();
        $this->applyFilters();

        return $this->builder->paginate($this->getPerPage());
    }

    protected function shouldScopeToWorkspace(): bool
    {
        return false;
    }

    protected function getBaseBuilder(): Builder
    {
        return Ad::query();
    }

    protected function applyFilter(Filter $filter): Builder
    {
        return match ($filter->key) {
            'created_at',
            'updated_at',
            'is_active',
            'type' => $this->simpleFilter($filter),
        };
    }
}
