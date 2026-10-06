import {appQueries} from '@app/app-queries';
import {Ad, AdType} from '@app/web-player/ads/ad';
import {onFormQueryError} from '@common/http/errors/on-form-query-error';
import {BackendResponse} from '@common/http/backend-response/backend-response';
import {apiClient, queryClient} from '@common/http/query-client';
import {toast} from '@shadcn/toast/toast';
import {Trans} from '@ui/i18n/trans';
import {useMutation} from '@tanstack/react-query';
import {UseFormReturn} from 'react-hook-form';

interface Response extends BackendResponse {
  data: Ad;
}

export interface CrupdateAdPayload {
  id?: number;
  type: AdType;
  name: string;
  advertiser_name: string;
  video_path: string | null;
  image_path: string | null;
  voiceover_path: string | null;
  click_through_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  weight: number;
  skip_after_seconds: number | null;
  is_active: boolean;
}

export function useCreateAd(form: UseFormReturn<CrupdateAdPayload>) {
  return useMutation({
    mutationFn: (props: CrupdateAdPayload) => createAd(props),
    onSuccess: () => {
      toast.success(<Trans message="Ad created" />);
      queryClient.invalidateQueries({
        queryKey: appQueries.ads.invalidateKey,
      });
    },
    onError: err => onFormQueryError(err, form),
  });
}

function createAd(payload: CrupdateAdPayload): Promise<Response> {
  return apiClient.post('ads', payload).then(r => r.data);
}
