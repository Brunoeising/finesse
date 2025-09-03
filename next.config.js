// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Remova ou comente essas linhas se estiver rodando em desenvolvimento
  // output: 'export',
  // trailingSlash: true,
  // assetPrefix: process.env.NODE_ENV === 'production' ? './' : '',
  
  images: {
    unoptimized: true
  },
  experimental: {
    // Configurações para extensões do Chrome
    esmExternals: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig