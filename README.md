# Alexandria

[![GitHub release](https://img.shields.io/github/v/release/JoshMiles/alexandria?include_prereleases&style=flat&label=latest%20release)](https://github.com/JoshMiles/alexandria/releases/latest)
[![GitHub issues](https://img.shields.io/github/issues/JoshMiles/alexandria?style=flat)](https://github.com/JoshMiles/alexandria/issues)
[![GitHub stars](https://img.shields.io/github/stars/JoshMiles/alexandria?style=flat)](https://github.com/JoshMiles/alexandria/stargazers)
[![GitHub license](https://img.shields.io/github/license/JoshMiles/alexandria?style=flat)](https://github.com/JoshMiles/alexandria/blob/main/LICENSE)

_Alexandria_ is a modern UI for searching Library Genesis (LibGen), featuring a built-in download manager and proxy support.

---

## 🚀 Latest Release

Download the latest release for your platform:

| Platform | Download Link |
|----------|---------------|
| **Windows** | [Alexandria-Setup-0.1.11.exe](https://github.com/JoshMiles/alexandria/releases/download/v0.1.11/Alexandria-Setup-0.1.11.exe) |
| **macOS Silicon**   | [Alexandria-0.1.11-arm64.dmg](https://github.com/JoshMiles/alexandria/releases/download/v0.1.11/Alexandria-0.1.11-arm64.dmg) |
| **macOS Intel**   | [Alexandria-0.1.11.dmg](https://github.com/JoshMiles/alexandria/releases/download/v0.1.11/Alexandria-0.1.11.dmg) |
| **Linux**   | [Alexandria-0.1.11.AppImage](https://github.com/JoshMiles/alexandria/releases/download/v0.1.11/Alexandria-0.1.11.AppImage) |
---

## ✨ Features

- **Modern UI** for searching and browsing LibGen
- **DOI support** for finding sci-hub related articles
- **Built-in Download Manager** for easy, reliable downloads
- **Proxy Support** to help you access LibGen even if it's blocked in your region

---

## 🛠️ Getting Started

Clone the repository:

```sh
git clone https://github.com/JoshMiles/alexandria.git
cd alexandria
```

Install dependencies:

```sh
npm install
```

Build the project:

```sh
npm run build
```

Package the app for distribution (using [Hydraulic Conveyor](https://conveyor.hydraulic.dev/)):

```sh
npm run build:conveyor
```

This will generate installers for Windows, macOS, and Linux in the `out/` directory.

---

## 🔄 Auto-Updates

Alexandria now uses [Hydraulic Conveyor](https://conveyor.hydraulic.dev/) for packaging and auto-updates. Updates are distributed via [GitHub Releases](https://github.com/JoshMiles/alexandria/releases). The app will automatically check for and download updates from the latest release.

---

## 🤝 Contributing

Contributions are welcome! Please open issues or pull requests to help improve Alexandria.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/JoshMiles/alexandria/blob/main/LICENSE) file for details.

---

## ⭐️ Community

For more information, visit the [Alexandria GitHub repository](https://github.com/JoshMiles/alexandria).

## Building and Packaging

This project uses [Electron Forge](https://www.electronforge.io/) for building, packaging, and auto-updates.

### Development

```
npm start
```

### Packaging for Distribution

```
npm run make
```

### Publishing Releases (with Auto-Update)

1. Bump your version in package.json.
2. Commit and push your changes.
3. Create a new GitHub release with the built artifacts from the `out/` directory.
4. Electron Forge's auto-updater will use GitHub releases for updates.


| Platform         | Installer/ZIP Link |
|------------------|-------------------|

| Platform         | Installer/ZIP Link |
|------------------|-------------------|
| Windows          | [Download EXE]() |
| macOS (Intel)    | [Download ZIP](https://github.com/JoshMiles/alexandria/releases/download/v0.1.57/alexandria-darwin-x64-0.1.57.zip) |
| macOS (Apple)    | [Download ZIP](https://github.com/JoshMiles/alexandria/releases/download/v0.1.57/alexandria-darwin-arm64-0.1.57.zip) |
| Linux (DEB)      | [Download DEB]() |
| Linux (RPM)      | [Download RPM]() |

