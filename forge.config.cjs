const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '{**/node_modules/@lancedb/**/*,**/node_modules/@tensorflow*/**/*,**/*.node}',
    },
    icon: './assets/icons/icon', // Don't include extension - Electron will pick the right one
    name: 'Snippet Vault',
    executableName: 'snippet-vault',
    appBundleId: 'com.rolandnyamoga.snippet-vault',
    // Disable code signing for CI builds to avoid "damaged" error
    // Enable this later when proper certificates are configured
    osxSign: false,
    // Only build for Apple Silicon on macOS
    arch: process.platform === 'darwin' ? 'arm64' : undefined,
    ignore: [
      // Exclude some large TensorFlow files that aren't needed
      /node_modules\/@tensorflow\/.*\/dist\/.*\.map$/,
      /node_modules\/@tensorflow\/.*\/dist\/.*test.*$/,
      /node_modules\/@tensorflow\/.*\/demo/,
      /node_modules\/@tensorflow\/.*\/docs/,
    ],
  },
  rebuildConfig: {},
  hooks: {
    prePackage: async () => {
      console.log('Running webpack build before packaging...');
      const { execSync } = require('child_process');
      execSync('npm run build:full', { stdio: 'inherit' });
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-wix',
      platforms: ['win32'],
      config: {
        name: 'Snippet Vault',
        description: 'A smart snippet management application',
        manufacturer: 'Roland Nyamoga',
        version: '1.0.0',
        icon: './assets/icons/icon.ico',
        ui: {
          chooseDirectory: true
        }
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {
        icon: './assets/icons/icon.icns'
      }
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
