import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { HomePage, RootLayout } from './pages'
import { CertificateForm } from './features/certificates/CertificateForm'

type RootSearch = {
  login?: 'failed'
}

const rootRoute = createRootRoute({
  component: RootLayout,
  validateSearch: (search: Record<string, unknown>): RootSearch =>
    search.login === 'failed' ? { login: 'failed' } : {},
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const newCertificateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/certificates/new',
  component: CertificateForm,
})

const routeTree = rootRoute.addChildren([indexRoute, newCertificateRoute])

export const router = createRouter({ routeTree })
