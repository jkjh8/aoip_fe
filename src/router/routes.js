const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  },
  {
    path: '/matrix',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/MatrixPage.vue') }],
  },
  {
    path: '/devices',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/DevicesPage.vue') }],
  },
  {
    path: '/stream',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/StreamPage.vue') }],
  },
  {
    path: '/settings',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/SettingsPage.vue') }],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
