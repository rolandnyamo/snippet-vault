const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '{**/node_modules/@lancedb/**/*,**/*.node,**/models/**/*}',
    },
    icon: './assets/icons/icon', // Don't include extension - Electron will pick the right one
    name: 'Snippet Vault',
    executableName: 'snippet-vault',
    appBundleId: 'com.rolandnyamoga.snippet-vault',
    // Universal macOS builds (Intel + Apple Silicon)
    ...(process.platform === 'darwin' && {
      arch: 'universal',
      osxSign: false, // Will add signing later
      osxNotarize: false, // Will add notarization later
    }),
    ignore: [
      // Ignore all ONNX-related packages to force web fallback
      /node_modules\/onnxruntime-node/,
      /node_modules\/onnx$/,
      /node_modules\/onnxjs$/,
      // Specifically ignore the ONNX backend from transformers
      /node_modules\/@xenova\/transformers\/src\/backends\/onnx\.js$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'SnippetVault',
        authors: 'Roland Nyamoga',
        exe: 'snippet-vault.exe',
        iconUrl: 'https://raw.githubusercontent.com/rolandnyamo/snippet-vault/main/assets/icons/icon.ico',
        setupIcon: './assets/icons/icon.ico',
        setupExe: 'SnippetVaultSetup.exe',
        noMsi: true
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
          name: 'snippet-vault',
          productName: 'Snippet Vault',
          genericName: 'Code Snippet Manager',
          description: 'A lightweight, offline desktop utility for storing and semantically searching code snippets',
          categories: ['Development', 'Utility'],
          maintainer: 'Roland Nyamoga <rolandn1844@gmail.com>',
          homepage: 'https://github.com/rolandnyamo/snippet-vault',
          icon: './assets/icons/icon.png',
          section: 'devel',
          priority: 'optional'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {
        options: {
          name: 'snippet-vault',
          productName: 'Snippet Vault',
          genericName: 'Code Snippet Manager',
          description: 'A lightweight, offline desktop utility for storing and semantically searching code snippets',
          categories: ['Development', 'Utility'],
          maintainer: 'Roland Nyamoga <rolandn1844@gmail.com>',
          homepage: 'https://github.com/rolandnyamo/snippet-vault',
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
