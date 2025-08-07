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
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'snippet-vault',
        iconUrl: 'https://raw.githubusercontent.com/rolandnyamo/snippet-vault/main/assets/icons/icon.ico',
        setupIcon: './assets/icons/icon.ico'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {
        icon: './assets/icons/icon.icns'
      }
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          icon: './assets/icons/icon.png'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {
        options: {
          icon: './assets/icons/icon.png'
        }
      },
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
