# Release Process Documentation

This document explains the automated build and release process for Snippet Vault using GitHub Actions.

## Overview

We use GitHub Actions to automate:
1. **Testing** - Build verification on all platforms for PRs and main branch
2. **Release Building** - Multi-platform builds triggered by version tags
3. **Package Distribution** - GitHub Releases for end-users, GitHub Packages for developers

## Prerequisites

- **Node.js 22+**: Required for development and CI/CD
- **npm 10+**: Package manager for dependencies
- **Git**: Version control and tagging

## Workflows

### 1. Build and Test (`build-test.yml`)
- **Triggers**: Push to main/dev, Pull Requests
- **Platforms**: macOS, Windows, Linux
- **Purpose**: Verify builds work on all platforms before merging

### 2. Build and Release (`release.yml`)
- **Triggers**: Version tags (`v*`), Manual dispatch
- **Platforms**: 
  - macOS Universal (Intel + Apple Silicon)
  - Windows x64
  - Linux x64
- **Outputs**: 
  - GitHub Release with downloadable installers
  - Cross-platform packages ready for distribution

### 3. GitHub Packages (`packages.yml`)
- **Triggers**: Version tags, Manual dispatch  
- **Purpose**: Publishes build artifacts and release info to GitHub Packages
- **Packages**:
  - `@rolandnyamo/snippet-vault` - Build artifacts
  - `@rolandnyamo/snippet-vault-release` - Release metadata and download links

## Release Process

### Automated Release (Recommended)

1. **Update version** and commit changes:
   ```bash
   npm run version:patch   # for bug fixes (1.0.0 → 1.0.1)
   npm run version:minor   # for new features (1.0.0 → 1.1.0)
   npm run version:major   # for breaking changes (1.0.0 → 2.0.0)
   ```

2. **Create and push the release**:
   ```bash
   npm run release:patch   # automatically pushes tag and triggers build
   ```

3. **Wait for GitHub Actions** to complete (usually 15-20 minutes)

4. **Verify the release** at https://github.com/rolandnyamo/snippet-vault/releases

### Manual Release

1. **Create a version tag manually**:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **Or trigger workflow manually**:
   - Go to Actions → "Build and Release"
   - Click "Run workflow"
   - Enter version (e.g., v1.0.1)

## Build Outputs

### macOS
- **File**: `snippet-vault-macos-universal.zip`
- **Architecture**: Universal (Intel + Apple Silicon)
- **Installation**: Extract .zip, move .app to Applications folder
- **Note**: Unsigned - users need to right-click → "Open" on first launch

### Windows  
- **File**: `snippet-vault-windows-x64-setup.exe`
- **Architecture**: x64
- **Installation**: Run installer executable
- **Note**: Unsigned - users may see SmartScreen warning

### Linux
- **File**: `snippet-vault-linux-x64.deb`
- **Architecture**: x64  
- **Installation**: `sudo dpkg -i snippet-vault-linux-x64.deb`
- **Supported**: Ubuntu 18.04+, Debian 10+

## Code Signing (Future Enhancement)

The current setup is configured to add code signing later without major changes:

### macOS Signing
Will require:
- Apple Developer certificate
- App Store Connect API key
- Update `forge.config.js`:
  ```javascript
  osxSign: {
    identity: "Developer ID Application: Your Name",
    "hardened-runtime": true,
    entitlements: "entitlements.plist"
  },
  osxNotarize: {
    teamId: "YOUR_TEAM_ID",
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER
  }
  ```

### Windows Signing
Will require:
- Code signing certificate
- Update GitHub Actions to use certificate
- Add signing step before making installer

## Troubleshooting

### Build Failures

1. **Check the GitHub Actions logs**:
   - Go to Actions tab
   - Click on the failed workflow
   - Review build logs for specific errors

2. **Common issues**:
   - **Model download failure**: Check network connectivity in CI
   - **Platform-specific build errors**: Often related to native dependencies
   - **Artifact upload issues**: Usually path or naming problems

### Testing Locally

Before creating a release, test the build process locally:

```bash
# Test all platforms (requires appropriate OS)
npm run make:mac     # On macOS
npm run make:win     # On Windows  
npm run make:linux   # On Linux

# Test universal build on macOS
npm run package:mac
```

### Release Verification

After a successful automated release:

1. **Download each platform package** from the GitHub Release
2. **Test installation** on target platforms
3. **Verify app functionality** - especially model loading and database operations
4. **Check for any console errors** during startup

## GitHub Packages Integration

The packages workflow also publishes to GitHub Packages for developer access:

### Access Build Artifacts
```bash
npm install @rolandnyamo/snippet-vault@latest
```

### Access Release Metadata
```bash
npm install @rolandnyamo/snippet-vault-release@latest
```

This provides programmatic access to download links and release information.

## Security Considerations

1. **No secrets in build artifacts** - All builds happen in clean environments
2. **Reproducible builds** - Same input always produces same output
3. **Audit trail** - All releases tracked in GitHub with full build logs
4. **Future signing** - Infrastructure ready for code signing certificates

## Monitoring and Metrics

- **Build times** are logged in GitHub Actions
- **Download statistics** available in GitHub Release insights
- **Package usage** tracked in GitHub Packages analytics

The release process is designed to be reliable, auditable, and easy to enhance with additional security measures as the project grows.
