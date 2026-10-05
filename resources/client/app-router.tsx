import {adminRoutes} from '@app/admin/admin-routes';
import {backstageRoutes} from '@app/web-player/backstage/backstage-routes';
import {webPlayerRoutes} from '@app/web-player/routes/web-player-routes';
import {listProductsForPricingPageOptions} from '@common/admin/subscriptions/products-queries';
import {authRoutes} from '@common/auth/auth-routes';
import {billingPageRoutes} from '@common/billing/billing-page/billing-page-routes';
import {checkoutRoutes} from '@common/billing/checkout/checkout-routes';
import {queryClient} from '@common/http/query-client';
import {
  RootErrorElement,
  RootRoute,
  rootRouteMiddleware,
} from '@common/core/common-provider';
import {commonRoutes} from '@common/core/common-routes';
import {notificationRoutes} from '@common/notifications/notification-routes';
import {companyRoutes} from '@app/company/company-routes';
import {getBootstrapData} from '@ui/bootstrap-data/bootstrap-data-store';
import {FullPageLoader} from '@ui/progress/full-page-loader';
import {createBrowserRouter} from 'react-router';

export const appRouter = createBrowserRouter(
  [
    {
      id: 'root',
      element: <RootRoute />,
      errorElement: <RootErrorElement />,
      hydrateFallbackElement: <FullPageLoader screen />,
      middleware: rootRouteMiddleware,
      children: [
        ...authRoutes(),
        ...notificationRoutes,
        ...adminRoutes,
        // Keekii's own pricing page, ahead of the shared billing routes below:
        // it groups the plans into Free, Pro Unlimited and Keekii Premium
        // instead of listing every product in the catalogue in one row.
        {
          path: 'pricing',
          lazy: () => import('@app/billing/pricing/grouped-pricing-page'),
          loader: () =>
            queryClient.ensureQueryData(listProductsForPricingPageOptions()),
        },
        ...checkoutRoutes,
        // Dropped rather than shadowed: the shared list also has a `pricing`
        // entry pointing at the flat table, and two routes on the same path
        // means the loser is dead weight that still gets bundled.
        ...billingPageRoutes.filter(route => route.path !== 'pricing'),
        ...commonRoutes,
        // Static public pages ahead of the web player so no dynamic route can
        // shadow them. See resources/client/company/company-routes.tsx.
        ...companyRoutes,
        ...webPlayerRoutes,
        ...backstageRoutes,
      ],
    },
  ],
  {
    basename: getBootstrapData().settings.html_base_uri,
  },
);
