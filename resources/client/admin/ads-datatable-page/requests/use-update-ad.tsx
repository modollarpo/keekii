import {CrupdateAdPayload} from '@app/admin/ads-datatable-page/requests/use-create-ad';
import {appQueries} from '@app/app-queries';
import {Ad} from '@app/web-player/ads/ad';
import {BackendResponse} from '@common/http/backend-response/backend-response';
import {onFormQueryError} from '@common/http/errors/on-form-query-error';
import {apiClient, queryClient} from '@common/http/query-client';
import {toast} from '@shadcn/toast/toast';
import {Trans} from '@ui/i18n/trans';
import {useMutation} from '@tanstack/react-query';
import {UseFormReturn} from 'react-hook-form';

interface Response extends BackendResponse {
  data: Ad;
}

export type UpdateAdPayload = CrupdateAdPayload;

export function useUpdateAd(form: UseFormReturn<UpdateAdPayload>) {
  return useMutation({
    mutationFn: (props: UpdateAdPayload) => updateAd(props),
    onSuccess: () => {
      toast.success(<Trans message="Ad updated" />);
      queryClient.invalidateQueries({
        queryKey: appQueries.ads.invalidateKey,
      });
    },
    onError: err => onFormQueryError(err, form),
  });
}

function updateAd({id, ...payload}: UpdateAdPayload): Promise<Response> {
  return apiClient.put(`ads/${id}`, payload).then(r => r.data);
}
