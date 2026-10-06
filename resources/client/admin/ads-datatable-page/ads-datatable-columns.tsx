import {UpdateAdDialog} from '@app/admin/ads-datatable-page/update-ad-dialog';
import {Ad} from '@app/web-player/ads/ad';
import {Button} from '@shadcn/button/button';
import {Badge} from '@shadcn/badge/badge';
import {Dialog} from '@shadcn/dialog/dialog';
import {checkboxColumnDef} from '@shadcn/table/utils/checkbox-column-def';
import {SortableHeader} from '@shadcn/table/utils/sortable-header';
import {ColumnDef} from '@tanstack/react-table';
import {FormattedDate} from '@ui/i18n/formatted-date';
import {FormattedNumber} from '@ui/i18n/formatted-number';
import {Trans} from '@ui/i18n/trans';
import {PencilIcon} from 'lucide-react';

export const adsDatatableColumns: ColumnDef<Ad>[] = [
  checkboxColumnDef<Ad>(),
  {
    id: 'name',
    accessorKey: 'name',
    enableSorting: true,
    size: 260,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Ad" />
      </SortableHeader>
    ),
    cell: ({row}) => {
      const ad = row.original;
      return (
        <div className="min-w-0">
          <div className="truncate">{ad.name}</div>
          <div className="text-muted-foreground truncate text-xs">
            {ad.advertiser_name}
          </div>
        </div>
      );
    },
  },
  {
    id: 'type',
    accessorKey: 'type',
    enableSorting: true,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Type" />
      </SortableHeader>
    ),
    cell: ({row}) => (
      <Badge variant="secondary" className="w-max capitalize">
        {row.original.type === 'video' ? (
          <Trans message="Video" />
        ) : (
          <Trans message="Image + voiceover" />
        )}
      </Badge>
    ),
  },
  {
    id: 'is_active',
    accessorKey: 'is_active',
    enableSorting: true,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Status" />
      </SortableHeader>
    ),
    cell: ({row}) =>
      row.original.is_active ? (
        <Badge variant="positive" className="w-max">
          <Trans message="Active" />
        </Badge>
      ) : (
        <Badge variant="secondary" className="w-max">
          <Trans message="Paused" />
        </Badge>
      ),
  },
  {
    id: 'weight',
    accessorKey: 'weight',
    enableSorting: true,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Weight" />
      </SortableHeader>
    ),
    cell: ({row}) => <FormattedNumber value={row.original.weight} />,
  },
  {
    id: 'impressions',
    accessorKey: 'impressions',
    enableSorting: true,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Impressions" />
      </SortableHeader>
    ),
    cell: ({row}) => <FormattedNumber value={row.original.impressions} />,
  },
  {
    id: 'completions',
    accessorKey: 'completions',
    enableSorting: true,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Completed" />
      </SortableHeader>
    ),
    cell: ({row}) => <FormattedNumber value={row.original.completions} />,
  },
  {
    id: 'skips',
    accessorKey: 'skips',
    enableSorting: true,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Skipped" />
      </SortableHeader>
    ),
    cell: ({row}) => <FormattedNumber value={row.original.skips} />,
  },
  {
    id: 'updated_at',
    accessorKey: 'updated_at',
    enableSorting: true,
    header: ({column}) => (
      <SortableHeader column={column}>
        <Trans message="Last updated" />
      </SortableHeader>
    ),
    cell: ({row}) =>
      row.original.updated_at ? (
        <time>
          <FormattedDate date={row.original.updated_at} />
        </time>
      ) : null,
  },
  {
    id: 'actions',
    size: 1,
    header: () => (
      <span className="hidden">
        <Trans message="Actions" />
      </span>
    ),
    cell: ({row}) => <AdActionsButton ad={row.original} />,
  },
];

export function AdActionsButton({ad}: {ad: Ad}) {
  return (
    <div className="text-muted-foreground flex justify-end">
      <UpdateAdDialog ad={ad}>
        <Dialog.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={e => e.stopPropagation()}
            />
          }
        >
          <PencilIcon />
          <span className="sr-only">
            <Trans message="Edit" />
          </span>
        </Dialog.Trigger>
      </UpdateAdDialog>
    </div>
  );
}
