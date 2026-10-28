/** @type {import('next').NextConfig} */

// Hosts públicos dos túneis (sem protocolo/porta). O Next usa essa lista para
// permitir Server Actions vindas dos domínios externos (CSRF/proxy).
function hostDoTunel(valor) {
  const bruto = (valor || '').trim().toLowerCase()
  if (!bruto) return ''
  try {
    if (bruto.includes('://')) return new URL(bruto).hostname
  } catch {
    // Segue para a normalização simples abaixo.
  }
  return bruto.split('/')[0].split(':')[0]
}

const allowedOrigins = [hostDoTunel(process.env.PUBLIC_TUNNEL_HOST), hostDoTunel(process.env.ADMIN_TUNNEL_HOST)].filter(
  Boolean
)

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
}

module.exports = nextConfig
