import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { HomePage, RootLayout } from './pages'
import { CertificateForm } from './features/certificates/CertificateForm'

const rootRoute = createRootRoute({ component: RootLayout })

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
